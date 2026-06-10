/**
 * Marker lists, path classification, secret patterns, and rule guidance.
 * Heuristic by design: no YAML parser, no AST, no network, no LLM.
 * This flags common risk patterns. It does not replace human review.
 */

export const AI_MARKERS = [
  "openai",
  "anthropic",
  "claude",
  "codex",
  "copilot",
  "cursor",
  "aider",
  "gemini",
  "llm",
  "agent",
  "ai-review",
  "reviewdog",
  "chatgpt",
];

/** Strong untrusted input markers: attacker controlled event bodies. */
export const UNTRUSTED_MARKERS = [
  "github.event.pull_request.body",
  "github.event.issue.body",
  "github.event.comment.body",
  "pull_request.body",
  "issue.body",
  "comment.body",
];

/**
 * Generic event payload access. Weaker signal. Requires the trailing dot
 * so that github.event_name does not match.
 */
export const GENERIC_EVENT_RE = /github\.event\./i;

export const PROVIDER_KEY_MARKERS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CLAUDE_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "AZURE_OPENAI",
  "OPENROUTER_API_KEY",
  "DEEPSEEK_API_KEY",
  "MISTRAL_API_KEY",
];

/** Write access that lets a workflow change code, runs, or identity. */
export const CRITICAL_WRITE_RES: RegExp[] = [
  /contents\s*:\s*write/i,
  /actions\s*:\s*write/i,
  /id-token\s*:\s*write/i,
  /write-all/i,
];

/** Write access that lets a workflow talk (comments on PRs and issues). */
export const COMMENT_WRITE_RES: RegExp[] = [
  /issues\s*:\s*write/i,
  /pull-requests\s*:\s*write/i,
];

export const SECRETS_USE_RE = /secrets\s*[.[]|secrets\s*:\s*inherit/i;
export const GITHUB_TOKEN_RE = /GITHUB_TOKEN/;

export const LARGE_DIFF_LINES = 500;
export const LARGE_DIFF_FILES = 20;

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-ish boundary match: letters and digits are word characters,
 * everything else (including underscore and dash) is a boundary.
 * So "agent" matches "my-agent" and "Ask the agent", and "openai"
 * matches "OPENAI_API_KEY". Case insensitive.
 */
export function matchMarker(line: string, marker: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(marker)}($|[^a-z0-9])`, "i");
  return re.test(line);
}

export const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "OpenAI style secret key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    name: "hardcoded credential assignment",
    re: /(api[_-]?key|secret|token|password|passwd)\s*[:=]\s*["'][A-Za-z0-9+/_=.-]{16,}["']/i,
  },
];

export type PathClass =
  | "auth"
  | "security"
  | "payments"
  | "billing"
  | "workflows"
  | "env"
  | "docker"
  | "lockfile"
  | "manifest"
  | "ci"
  | "migration"
  | "tests"
  | "docs"
  | "src"
  | "other";

const LOCKFILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "poetry.lock",
  "cargo.lock",
  "composer.lock",
]);

const MANIFESTS = new Set(["package.json", "requirements.txt", "pyproject.toml"]);

const SRC_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rb", "rs", "java",
  "kt", "cs", "php", "c", "cc", "cpp", "h", "hpp", "swift", "scala", "sql",
]);

const DOC_EXTS = new Set(["md", "mdx", "rst", "adoc", "txt"]);

export function isTestPath(norm: string): boolean {
  if (/(^|\/)(tests?|__tests__|specs?)(\/)/.test(norm)) return true;
  if (/\.(test|spec)\.[a-z0-9]+$/.test(norm)) return true;
  return false;
}

export function classifyPath(p: string): PathClass {
  const norm = p.replace(/\\/g, "/").toLowerCase();
  const parts = norm.split("/");
  const base = parts[parts.length - 1] ?? "";
  const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";

  if (norm.includes(".github/workflows/")) return "workflows";
  if (base.startsWith(".env")) return "env";
  if (LOCKFILES.has(base)) return "lockfile";
  if (MANIFESTS.has(base)) return "manifest";
  if (base === "dockerfile" || base.startsWith("dockerfile.") || base.startsWith("docker-compose")) return "docker";
  if (parts.some((s) => s === "auth" || s === "authentication")) return "auth";
  if (parts.some((s) => s === "security")) return "security";
  if (parts.some((s) => s === "payments" || s === "payment")) return "payments";
  if (parts.some((s) => s === "billing")) return "billing";
  if (parts.some((s) => s === "migrations" || s === "migration") || base.includes("migration")) return "migration";
  if (isTestPath(norm)) return "tests";
  if (parts[0] === "docs" || DOC_EXTS.has(ext)) return "docs";
  if (
    parts.some((s) => s === ".circleci" || s === "deploy" || s === "infra" || s === "k8s" || s === "helm" || s === "terraform") ||
    base === "jenkinsfile" ||
    base === ".gitlab-ci.yml" ||
    ext === "tf"
  ) {
    return "ci";
  }
  if (SRC_EXTS.has(ext)) return "src";
  return "other";
}

export const SENSITIVE_NO_TESTS_CLASSES: PathClass[] = ["auth", "security", "payments", "billing"];

/** Per rule: which receipt is missing, and what to do next. */
export const GUIDANCE: Record<string, { missing: string; next: string }> = {
  "wf.pull_request_target_with_ai": {
    missing: "justification receipt for pull_request_target in an AI workflow",
    next: "switch to pull_request, or fully isolate the privileged job from untrusted PR content",
  },
  "wf.untrusted_input_with_ai": {
    missing: "sanitization receipt for untrusted PR, issue, or comment input",
    next: "stop passing event bodies into prompts or scripts, pass an opaque reference instead",
  },
  "wf.write_access_with_untrusted_input": {
    missing: "least privilege permissions receipt",
    next: "set permissions to read where untrusted input is read",
  },
  "wf.secrets_with_untrusted_and_ai": {
    missing: "secret isolation receipt",
    next: "move secrets to a separate job that never sees untrusted input",
  },
  "wf.no_permissions_block": {
    missing: "explicit permissions block",
    next: "add a permissions block with least privilege",
  },
  "wf.unpinned_actions": {
    missing: "SHA pin receipt for third party actions",
    next: "pin every action to a full commit SHA",
  },
  "wf.comment_with_untrusted_input": {
    missing: "output handling receipt for PR comments",
    next: "review what the workflow is allowed to post while reading event input",
  },
  "wf.provider_key_in_env": {
    missing: "key scope receipt for the AI provider credential",
    next: "scope the provider key to the minimal job and rotate it regularly",
  },
  "wf.generic_event_input": {
    missing: "input provenance receipt for github.event fields",
    next: "verify which event fields are attacker controlled before using them",
  },
  "wf.no_receipt_policy": {
    missing: "receipt policy (.ace/policy.yml) or an ace-receipts gate in the workflow",
    next: "add ace-receipts to the workflow or create .ace/policy.yml",
  },
  "wf.no_human_gate": {
    missing: "human approval gate (environment protection rule)",
    next: "add environment: with a required reviewer for agentic runs",
  },
  "diff.workflows_touched": {
    missing: "human review receipt for workflow changes",
    next: "require explicit human approval for .github/workflows changes",
  },
  "diff.sensitive_without_tests": {
    missing: "tests covering the touched sensitive area",
    next: "add or update tests for auth, security, payments, or billing changes",
  },
  "diff.lockfile_changed": {
    missing: "dependency change receipt (what changed and why)",
    next: "review the lockfile delta and link the dependency justification",
  },
  "diff.env_file_touched": {
    missing: "secret handling receipt for environment files",
    next: "keep env files out of diffs, use a secret manager",
  },
  "diff.secret_added": {
    missing: "secret rotation receipt",
    next: "remove the credential from the diff and rotate it now",
  },
  "diff.migration_without_rollback": {
    missing: "rollback note for the migration",
    next: "add a rollback or down path note to the migration",
  },
  "diff.src_without_tests": {
    missing: "tests matching the source change",
    next: "add or update tests for the changed source files",
  },
  "diff.config_touched": {
    missing: "config and deploy review receipt",
    next: "have a human review config, Docker, CI, or manifest changes",
  },
  "diff.large_diff": {
    missing: "scope receipt (why one change this large)",
    next: "split the change or document why it must land as one",
  },
  "diff.unavailable": {
    missing: "a diff to inspect",
    next: "pipe a diff on stdin or run inside a git repository",
  },
  "file.not_found": {
    missing: "the file to inspect",
    next: "check the path and run again",
  },
  "file.secret_in_file": {
    missing: "secret rotation receipt",
    next: "remove the credential from the file and rotate it now",
  },
  "file.sensitive_path": {
    missing: "review receipt for the sensitive area",
    next: "require human review for changes under this path",
  },
};
