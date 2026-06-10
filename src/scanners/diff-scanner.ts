import {
  LARGE_DIFF_FILES,
  LARGE_DIFF_LINES,
  SECRET_PATTERNS,
  SENSITIVE_NO_TESTS_CLASSES,
  classifyPath,
} from "../core/rules.js";
import type { Finding } from "../types/receipt.js";

export interface DiffFile {
  path: string;
  added: { n: number; text: string }[];
  addedCount: number;
  removedCount: number;
  isNew: boolean;
  isDeleted: boolean;
}

/** Minimal unified diff parser. Good enough for git diff output. */
export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let cur: DiffFile | null = null;
  let pendingNew = false;
  let lastMinusPath = "";
  let newLine = 0;

  for (const raw of text.split(/\r?\n/)) {
    if (raw.startsWith("diff --git ")) {
      cur = null;
      pendingNew = false;
      continue;
    }
    if (raw.startsWith("new file mode")) {
      pendingNew = true;
      continue;
    }
    if (raw.startsWith("--- ")) {
      const p = raw.slice(4).trim();
      lastMinusPath = p.startsWith("a/") ? p.slice(2) : p;
      continue;
    }
    if (raw.startsWith("+++ ")) {
      const p = raw.slice(4).trim();
      if (p === "/dev/null") {
        cur = {
          path: lastMinusPath,
          added: [],
          addedCount: 0,
          removedCount: 0,
          isNew: false,
          isDeleted: true,
        };
        files.push(cur);
        continue;
      }
      cur = {
        path: p.startsWith("b/") ? p.slice(2) : p,
        added: [],
        addedCount: 0,
        removedCount: 0,
        isNew: pendingNew,
        isDeleted: false,
      };
      files.push(cur);
      pendingNew = false;
      continue;
    }
    if (cur === null) continue;

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
    if (hunk) {
      newLine = parseInt(hunk[1], 10) - 1;
      continue;
    }
    if (raw.startsWith("+")) {
      newLine += 1;
      cur.addedCount += 1;
      cur.added.push({ n: newLine, text: raw.slice(1) });
    } else if (raw.startsWith("-")) {
      cur.removedCount += 1;
    } else {
      newLine += 1;
    }
  }
  return files;
}

export function scanDiff(text: string): { findings: Finding[]; summary: string } {
  const files = parseDiff(text);
  const findings: Finding[] = [];

  if (files.length === 0) {
    return { findings, summary: "Empty diff. Nothing to gate." };
  }

  const classes = files.map((f) => ({ f, cls: classifyPath(f.path) }));
  const testsChanged = classes.some((x) => x.cls === "tests");
  const docsOnly = classes.every((x) => x.cls === "docs");
  const testsOnly = classes.every((x) => x.cls === "tests");

  for (const { f, cls } of classes) {
    if (cls === "workflows") {
      findings.push({
        id: "diff.workflows_touched",
        severity: "high",
        impact: "fail",
        file: f.path,
        message: "GitHub workflow file changed in this diff. Workflow changes need explicit human review.",
      });
    }
    if (SENSITIVE_NO_TESTS_CLASSES.includes(cls) && !testsChanged) {
      findings.push({
        id: "diff.sensitive_without_tests",
        severity: "high",
        impact: "fail",
        file: f.path,
        message: `Sensitive area (${cls}) changed without any test changes in the diff.`,
      });
    }
    if (cls === "lockfile") {
      findings.push({
        id: "diff.lockfile_changed",
        severity: "high",
        impact: "fail",
        file: f.path,
        message: "Dependency lock file changed. Verify the dependency delta before merge.",
      });
    }
    if (cls === "env") {
      findings.push({
        id: "diff.env_file_touched",
        severity: "high",
        impact: "fail",
        file: f.path,
        message: "Environment file changed in the diff. Env files should not travel in PRs.",
      });
    }
    for (const a of f.added) {
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(a.text)) {
          findings.push({
            id: "diff.secret_added",
            severity: "high",
            impact: "fail",
            file: f.path,
            line: a.n,
            message: `Secret looking string added (${p.name}). Value not shown.`,
          });
          break;
        }
      }
    }
    if (cls === "migration" && !f.isDeleted) {
      const hasRollback =
        f.added.some((a) => /\b(rollback|revert|down)\b/i.test(a.text)) ||
        /\brollback\b/i.test(text);
      if (!hasRollback) {
        findings.push({
          id: "diff.migration_without_rollback",
          severity: "high",
          impact: "fail",
          file: f.path,
          message: "Migration changed without a rollback or down path note.",
        });
      }
    }
  }

  const srcFiles = classes.filter((x) => x.cls === "src");
  if (srcFiles.length > 0 && !testsChanged) {
    const names = srcFiles.slice(0, 3).map((x) => x.f.path).join(", ");
    findings.push({
      id: "diff.src_without_tests",
      severity: "medium",
      impact: "hold",
      message: `${srcFiles.length} source file(s) changed with no test changes (${names}).`,
    });
  }

  const configFiles = classes.filter(
    (x) => x.cls === "docker" || x.cls === "manifest" || x.cls === "ci",
  );
  if (configFiles.length > 0) {
    const names = configFiles.slice(0, 3).map((x) => x.f.path).join(", ");
    findings.push({
      id: "diff.config_touched",
      severity: "medium",
      impact: "hold",
      message: `Config, Docker, CI, or manifest file(s) changed (${names}).`,
    });
  }

  const totalChanged = files.reduce((s, f) => s + f.addedCount + f.removedCount, 0);
  if (totalChanged > LARGE_DIFF_LINES || files.length > LARGE_DIFF_FILES) {
    findings.push({
      id: "diff.large_diff",
      severity: "medium",
      impact: "hold",
      message: `Large diff: ${files.length} file(s), ${totalChanged} changed line(s). Hard to review, easy to hide.`,
    });
  }

  if (docsOnly) {
    findings.push({
      id: "diff.docs_only",
      severity: "low",
      impact: "info",
      message: "Docs only change.",
    });
  }
  if (testsOnly) {
    findings.push({
      id: "diff.tests_only",
      severity: "low",
      impact: "info",
      message: "Tests only change.",
    });
  }

  const added = files.reduce((s, f) => s + f.addedCount, 0);
  const removed = files.reduce((s, f) => s + f.removedCount, 0);
  const summary = `Diff: ${files.length} file(s), +${added} -${removed}. Findings: ${findings.length}.`;
  return { findings, summary };
}
