# ACE Receipt: FAIL

```text
          ✦
      /_\ │
     (•_•)│
      /|_ │
      / \ │
   ════╪════
         │
```

> Vibes shall not pass.

| Field | Value |
| --- | --- |
| Verdict | fail |
| Gate | fail |
| Proof | weak |
| Risk | high |
| Permission | blocked |
| Closeout | blocked |

Command: `ace-receipts check --file examples/vulnerable-workflow.yml`

Summary: Workflow examples/vulnerable-workflow.yml: AI markers detected. Findings: 7.

## Findings

- **HIGH** `examples/vulnerable-workflow.yml:5` pull_request_target used in a workflow with AI markers. Untrusted PR content can reach a privileged context.
- **HIGH** `examples/vulnerable-workflow.yml:25` Untrusted event input (github.event.pull_request.body) flows into an AI workflow. Prompt injection risk.
- **HIGH** `examples/vulnerable-workflow.yml:9` Write permissions granted while the workflow reads untrusted event input.
- **HIGH** `examples/vulnerable-workflow.yml:22` Secrets are available in a workflow that reads untrusted input and uses AI markers.
- **MEDIUM** `examples/vulnerable-workflow.yml:16` 1 action reference(s) not pinned to a full commit SHA (first: actions/checkout@v4).
- **MEDIUM** `examples/vulnerable-workflow.yml:22` AI provider key referenced in workflow (OPENAI_API_KEY).
- **LOW** `examples/vulnerable-workflow.yml` No environment protection rule on an agentic workflow. No manual approval gate detected.

## Missing receipts

- justification receipt for pull_request_target in an AI workflow
- sanitization receipt for untrusted PR, issue, or comment input
- least privilege permissions receipt
- secret isolation receipt
- SHA pin receipt for third party actions
- key scope receipt for the AI provider credential
- human approval gate (environment protection rule)

## Next

- switch to pull_request, or fully isolate the privileged job from untrusted PR content
- stop passing event bodies into prompts or scripts, pass an opaque reference instead
- set permissions to read where untrusted input is read
- move secrets to a separate job that never sees untrusted input
- pin every action to a full commit SHA
- scope the provider key to the minimal job and rotate it regularly
- add environment: with a required reviewer for agentic runs

**No receipt, no passage.**
