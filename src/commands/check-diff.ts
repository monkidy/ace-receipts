import { spawnSync } from "node:child_process";
import { emit } from "../core/output.js";
import { buildReceipt } from "../core/receipt.js";
import { scanDiff } from "../scanners/diff-scanner.js";

/**
 * Read stdin if data is actually piped in. If stdin is a TTY, or stays
 * silent for 300 ms (open but empty pipe), fall back to git diff instead
 * of hanging forever.
 */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  return await new Promise<string>((resolve) => {
    let data = "";
    let started = false;

    const finish = (value: string): void => {
      clearTimeout(timer);
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onEnd);
      resolve(value);
    };
    const MAX_STDIN = 64 * 1024 * 1024;
    const onData = (chunk: string): void => {
      started = true;
      data += chunk;
      if (data.length > MAX_STDIN) {
        process.stdin.pause();
        finish(data);
      }
    };
    const onEnd = (): void => finish(data);
    const timer = setTimeout(() => {
      if (!started) {
        process.stdin.pause();
        finish("");
      }
    }, 300);

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
    process.stdin.on("error", onEnd);
  });
}

function gitDiff(base?: string): string | null {
  const attempts = base ? [["diff", `${base}...HEAD`]] : [["diff", "HEAD"], ["diff"]];
  for (const args of attempts) {
    const r = spawnSync("git", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status === 0) return r.stdout;
  }
  return null;
}

export async function runCheckDiff(base?: string): Promise<number> {
  const stdinText = await readStdin();
  const diffText = stdinText.trim().length > 0 ? stdinText : gitDiff(base);

  if (diffText === null) {
    const receipt = buildReceipt({
      command: "check --diff",
      summary: "Could not obtain a diff: no stdin input and git diff failed. Fail closed.",
      findings: [
        {
          id: "diff.unavailable",
          severity: "high",
          impact: "fail",
          message: "No diff available. Pipe a diff on stdin or run inside a git repository.",
        },
      ],
    });
    return emit(receipt);
  }

  const { findings, summary } = scanDiff(diffText);
  const command = base ? `check --diff --base ${base}` : "check --diff";
  return emit(buildReceipt({ command, summary, findings }));
}
