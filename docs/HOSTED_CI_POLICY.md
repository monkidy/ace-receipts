# ACE Receipts — GitHub Actions independence

Status: repository-local canon
Date: 2026-08-23

GitHub Actions is an optional wrapper, never an authority or required execution path.

```text
GITHUB_ACTIONS_REQUIRED = NEVER
HOSTED_CI               = OPTIONAL_BUDGET_GATED
HOSTED_CI_TRIGGER       = MANUAL_ONLY
NATIVE_ENTRYPOINT       = REQUIRED
```

## Native verification

Run on any controlled machine with Node 20+:

```text
npm ci
npm run typecheck
npm test
node dist/src/cli.js scan-workflows
node dist/src/cli.js check --file examples/safe-workflow.yml
node dist/src/cli.js check --file examples/vulnerable-workflow.yml   # must fail
```

The last command is a negative gate: success is a defect; rejection is the expected result.

## Native metrics

```text
node scripts/metrics.mjs
```

`GITHUB_TOKEN` is optional for public API access and may be supplied when higher authenticated API limits are useful. Commit `metrics/ace-receipts.csv` only when a durable snapshot is wanted. Scheduling belongs to the controlled environment, not to paid GitHub-hosted compute.

## Native release

A release can be completed without GitHub Actions:

```text
npm ci
npm run typecheck
npm test
npm publish --access public
gh release create v<VERSION> --target <EXACT_SHA> --title v<VERSION> --notes "Release v<VERSION>."
```

Use normal npm authentication on the controlled machine and an authenticated GitHub CLI. Verify that the version/tag does not already exist before publishing.

The manual `.github/workflows/release.yml` may reproduce this path when explicitly useful, but its absence, failure or budget block never prevents release.

## Rule

A defect found by an actually executed GitHub Actions job is real evidence. GitHub Actions itself is not evidence and never becomes a mandatory merge, release, publication or truth gate.
