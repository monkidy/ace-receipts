# ACE Receipt: HOLD

```text
          ✦
      /_\ │
     (•_•)│
      /|_ │
      / \ │
   ════╪════
         │
```

> Not yet. Bring receipts.

| Field | Value |
| --- | --- |
| Verdict | hold |
| Gate | fail |
| Proof | partial |
| Risk | medium |
| Permission | human_review_required |
| Closeout | pending |

Command: `ace-receipts demo`

Summary: Demo scan of a simulated AI agent workflow. The gate holds until receipts arrive. Run scan-workflows on a real repo next.

## Findings

- **MEDIUM** `demo/.github/workflows/agent-review.yml` No explicit permissions block in an AI workflow. Default token permissions apply.
- **MEDIUM** `demo/.github/workflows/agent-review.yml:14` 1 action reference(s) not pinned to a full commit SHA (first: actions/checkout@v4).
- **LOW** `demo/.github/workflows/agent-review.yml` AI workflow detected but no receipt policy found (.ace/policy.yml or an ace-receipts gate).

## Missing receipts

- explicit permissions block
- SHA pin receipt for third party actions
- receipt policy (.ace/policy.yml) or an ace-receipts gate in the workflow

## Next

- add a permissions block with least privilege
- pin every action to a full commit SHA
- add ace-receipts to the workflow or create .ace/policy.yml

**No receipt, no passage.**
