#!/usr/bin/env node
import { Command } from "commander";
import { runCheckDiff } from "./commands/check-diff.js";
import { runCheckFile } from "./commands/check-file.js";
import { runDemo } from "./commands/demo.js";
import { runReport } from "./commands/report.js";
import { runScanWorkflows } from "./commands/scan-workflows.js";
import { SLOGAN } from "./core/phrases.js";
import { VERSION } from "./core/receipt.js";

const program = new Command();

program.name("ace-receipts").description(SLOGAN).version(VERSION);

program
  .command("demo")
  .description("Meet the Gate Wizard. Sample scan, sample receipt, no setup.")
  .action(() => {
    process.exitCode = runDemo();
  });

program
  .command("scan-workflows")
  .description("Scan .github/workflows for risky AI agent workflow patterns.")
  .option("--dir <path>", "repository root to scan", ".")
  .action((opts: { dir: string }) => {
    process.exitCode = runScanWorkflows(opts.dir);
  });

program
  .command("report")
  .description("Scan the repo and emit a shareable AI agent workflow governance report.")
  .option("--dir <path>", "repository root to scan", ".")
  .option("--format <fmt>", "output format: md or json", "md")
  .option("--quiet", "write report files without printing to stdout")
  .action((opts: { dir: string; format: string; quiet?: boolean }) => {
    process.exitCode = runReport(opts);
  });

program
  .command("check")
  .description("Check a diff (stdin or git) or a single file. Emits a receipt.")
  .option("--diff", "check a diff from stdin, or from git if stdin is empty")
  .option("--file <path>", "check a single file")
  .option("--base <ref>", "git base ref for --diff (uses git diff <ref>...HEAD)")
  .action(async (opts: { diff?: boolean; file?: string; base?: string }) => {
    if (opts.file) {
      process.exitCode = runCheckFile(opts.file);
    } else if (opts.diff) {
      process.exitCode = await runCheckDiff(opts.base);
    } else {
      console.error("check requires --diff or --file <path>. Fail closed.");
      process.exitCode = 2;
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 2;
});
