# Ungated payments agent (fixture)

A payments agent with no human approval. It exists so the
`human-approval-gate` skill has something to add a gate to, and so the
`human-approval-audit` skill has something to score afterwards.

- `src/bank.ts`: the irreversible action, `transferFunds`, mocked onto a ledger.
- `src/slack.ts`: mock Slack: records outbound messages, exposes the signing
  secret and the HMAC scheme real Slack uses for interaction callbacks.
- `src/agent.ts`: one simulated model turn that calls `payVendor`.

```bash
npm test
```

The task: transfers over 1,000 must be approved by a human in Slack before
they execute, and the approval must prove the action. Done well, running the
audit skill on the result returns "proves the action" or, without a
third-party-verifiable receipt, "proves a click (6 fails)" with every other
property passing.
