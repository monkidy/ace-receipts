import { buildReport, renderReportMarkdown, writeReportFiles } from "../core/report.js";
import { exitCode } from "../core/risk.js";

/**
 * Build a repo-level governance report, print it (Markdown by default,
 * JSON on request), and always persist it under .ace/reports/.
 * Exit code mirrors the posture verdict so CI can gate on the report too.
 */
export function runReport(opts: { dir?: string; format?: string; quiet?: boolean }): number {
  const dir = opts.dir ?? ".";
  const report = buildReport(dir);
  const format = (opts.format ?? "md").toLowerCase();

  if (!opts.quiet) {
    console.log(format === "json" ? JSON.stringify(report, null, 2) : renderReportMarkdown(report));
  }

  const { md, json } = writeReportFiles(report, dir);
  if (!opts.quiet) {
    console.error(`Saved: ${md} and ${json}`);
  }

  return exitCode(report.posture.verdict);
}
