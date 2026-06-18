# ACE Receipts

[![CI](https://github.com/monkidy/ace-receipts/actions/workflows/ci.yml/badge.svg)](https://github.com/monkidy/ace-receipts/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/ace-receipts)](https://www.npmjs.com/package/ace-receipts) [![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

AI agents can cook. Make them bring receipts.

ACE Receipts is a tiny CLI + GitHub Action that scans AI-agent GitHub workflows and AI-generated diffs for proof, risk, permission, missing evidence, and closeout.

No cloud. No API key. No vibes.

```bash
npx ace-receipts demo
```

## The Gate Wizard

Every command ends at the gate:

```text
ACE RECEIPT: HOLD

          ✦
      /_\ │
     (•_•)│
      /|_ │
      / \ │
   ════╪════
         │

Not yet. Bring receipts.

Gate:       FAIL
Proof:      partial
Risk:       high
Permission: human_review_required

No receipt, no passage.
```

One line per verdict, always the same:

| Verdict | Line | Exit code |
| --- | --- | --- |
| PASS | Proof opens the gate. | 0 |
| HOLD | Not yet. Bring receipts. | 1 |
| FAIL | Vibes shall not pass. | 2 |

The demo receipt is a HOLD, so `demo` exits 1. Fail closed is the point.

## Why receipts?

AI agents now open PRs, edit workflows, and ship diffs. Output is cheap. Trust is not.

A receipt is the difference between "the agent said it is fine" and "here is what was seen, what was proven, what is risky, and what is allowed to happen next."

ACE Receipts never calls a model. It reads files locally, applies deterministic rules, and writes the receipt. It flags common risk patterns and helps review. It does not replace human review, and it does not claim to catch every attack.

## What it does / what it does not do

What it does:

- scans `.github/workflows` for common agentic risk patterns, locally
- scans diffs for risk, missing tests, secrets, and missing evidence
- applies deterministic rules: same input, same verdict
- writes a Markdown and a JSON receipt on every run
- fails closed: exit 0 PASS, exit 1 HOLD, exit 2 FAIL

What it does not do:

- it does not call an LLM or any API, and it makes no network calls
- it does not send your code anywhere
- it does not modify your repository: it only writes `.ace/receipts/`
- it does not replace human review
- it does not claim to catch every attack

## Install / run

Run without installing:

```bash
npx ace-receipts demo
npx ace-receipts scan-workflows
npx ace-receipts report
git diff | npx ace-receipts check --diff
npx ace-receipts check --file path/to/file
```

From source:

```bash
git clone https://github.com/monkidy/ace-receipts
cd ace-receipts
npm install
npm test
node dist/src/cli.js demo
```

Every command prints a terminal receipt and writes two files:

- `.ace/receipts/latest.md`
- `.ace/receipts/latest.json`

Terminal notes: colors respect `NO_COLOR`. For terminals without unicode, set `ACE_RECEIPTS_ASCII=1`.

## scan-workflows

The hero feature. Agentic workflows are the new attack surface: untrusted PR text flowing into prompts, write tokens next to model calls, secrets in reach of injected instructions.

```bash
npx ace-receipts scan-workflows
```

Scans `.github/workflows/**/*.yml` and `*.yaml`, detects AI markers (openai, anthropic, claude, copilot, aider, agent, llm, and friends), then applies deterministic rules:

| Level | Pattern |
| --- | --- |
| High | `pull_request_target` together with AI or agent markers |
| High | untrusted PR, issue, or comment body flowing into prompts or scripts |
| High | write token or write permissions while reading untrusted event input |
| High | secrets available in a job with untrusted input and AI markers |
| Medium | no explicit `permissions:` block in an AI workflow |
| Medium | actions not pinned to a full commit SHA |
| Medium | workflow can post comments while reading event input |
| Medium | AI provider key referenced in workflow env |
| Low | AI workflow without a receipt policy |
| Low | no manual approval gate (environment protection) on an agentic workflow |

## check --diff

For AI-generated code, before merge:

```bash
git diff | npx ace-receipts check --diff
npx ace-receipts check --diff --base origin/main
npx ace-receipts check --file path/to/changes.diff
```

Reads a unified diff from stdin, or from `git diff` if stdin is empty, then applies deterministic rules:

| Level | Pattern |
| --- | --- |
| High | auth, security, payments, or billing files changed without test changes |
| High | `.github/workflows/**` touched |
| High | dependency lock files changed |
| High | secret looking strings added |
| High | env files in the diff, or migrations without a rollback note |
| Medium | source changed with no test changes |
| Medium | config, Docker, CI, or manifest files touched |
| Medium | large diff (over 500 changed lines or 20 files) |
| Low | docs only or tests only (these pass) |

## report

One receipt answers "can this change merge". One report answers "what is the governance posture of this repository", for a reviewer, a security lead, or a client.

```bash
npx ace-receipts report
npx ace-receipts report --format json
```

`report` scans every workflow in the repo, aggregates the findings with the same fail-closed logic as a single receipt, and writes a shareable governance report to `.ace/reports/`:

- `.ace/reports/governance-report.md`
- `.ace/reports/governance-report.json`

The report carries the overall posture (verdict, gate, proof, risk, permission, closeout), severity totals, a per-workflow inventory (which workflows use AI, and their verdict, riskiest first), the findings, and the next actions. The exit code mirrors the posture verdict, so CI can gate on the report too.

## Receipt schema

`.ace/receipts/latest.json`:

```json
{
  "schema": "ace.receipt.v0",
  "tool": "ace-receipts",
  "version": "0.1.2",
  "command": "scan-workflows",
  "verdict": "hold",
  "gate": "fail",
  "proof": "partial",
  "risk": "medium",
  "permission": "human_review_required",
  "summary": "Scanned 3 workflow file(s). AI workflows detected: 1. Findings: 2.",
  "findings": [],
  "missing_receipts": [],
  "next": [],
  "closeout": "pending",
  "saved_to": ".ace/receipts/latest.json"
}
```

Verdict mapping: `pass` (exit 0), `hold` (exit 1), `fail` (exit 2). The gate is closed by default: any blocking finding fails it, any gap holds it.

## GitHub Action

The Action runs the same gate in CI and appends the Markdown receipt to the step summary.

```yaml
name: Agent gate
on:
  pull_request:

permissions:
  contents: read

jobs:
  receipts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Scan agentic workflows
      - uses: monkidy/ace-receipts@main

      # Or gate the PR diff
      - uses: monkidy/ace-receipts@main
        with:
          mode: diff
          base: origin/${{ github.base_ref }}
```

The job fails on FAIL (exit 2) and on HOLD (exit 1). Add `continue-on-error: true` if you want advisory mode.

## Examples

The `examples/` folder ships three artifacts and their receipts:

- `vulnerable-workflow.yml`: an AI auto review workflow with `pull_request_target`, write permissions, secrets, and PR body in the prompt. Verdict: FAIL.
- `safe-workflow.yml`: an agent gate with read permissions, a pinned SHA, an environment approval, and a receipt step. Verdict: PASS.
- `risky-ai-pr.diff`: an AI PR touching workflows, payments code without tests, a lockfile, and a pasted key. Verdict: FAIL.

Try them:

```bash
npx ace-receipts check --file examples/vulnerable-workflow.yml
npx ace-receipts check --file examples/safe-workflow.yml
npx ace-receipts check --file examples/risky-ai-pr.diff
```

Sample receipts live in `examples/receipts/`.

## Limitations

Honest list, V0:

- detection is marker and regex based, false positives happen (for example `cursor` or `agent` appearing in unrelated contexts)
- no structural YAML parsing yet, rules read lines, not the workflow graph
- secret patterns are heuristic and not exhaustive
- `latest.md` and `latest.json` are overwritten on each run, no history yet
- rules target common risk patterns, not novel or determined attackers

## Roadmap

- PR comment mode for the GitHub Action
- SARIF output for code scanning integration
- `.ace/policy.yml` with custom rules and thresholds
- Receipt history (beyond `latest.*`)
- Baselines and allowlists for known findings

## Philosophy

Most AI tools generate output. ACE Receipts asks what should be allowed to happen next.

A receipt is a small operational record: what was seen, what was proven, what is risky, what is allowed, and what must happen before action.

No receipt, no passage.

## Pro / Governance Pack (in progress)

The CLI and the Action are free, and they stay free.

For teams under audit or the EU AI Act, a **Governance Pro Pack** is in the works: hardened `.ace/policy.yml` templates, and a crosswalk from each rule to the OWASP LLM Top 10 and EU AI Act articles, so a scan result maps straight to the framework a reviewer or auditor asks about.

Want it for your team? [Open an issue](https://github.com/monkidy/ace-receipts/issues/new) or [sponsor the project](https://github.com/sponsors/monkidy).

## License

Apache-2.0. See [LICENSE](LICENSE).
