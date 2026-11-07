# Vulnerable payments agent (fixture)

A deliberately flawed human-approval flow for an AI agent that moves money.
It exists so the `human-approval-audit` skill has something to audit, and so you
can see what a failing report looks like before running it on your own code.

Do not copy any of this into production.

## What it does

1. `agent.ts` decides to call `transferFunds` and, if the amount is over the
   threshold, parks the call in `state.json` as `pendingAction` and posts an
   approval request to Slack (mocked in `notify.ts`).
2. `approvals.ts` exposes `POST /approvals/callback`. Slack (or anyone) posts
   `{ requestId, decision, approver }`. On `approve`, the state flips to
   approved.
3. `executor.ts` wakes up, re-reads `state.json`, and executes whatever is in
   `pendingAction` now.
4. `audit.ts` appends a line to `audit.log`.

There is also an email fallback: if Slack is down, `notify.ts` emails a 6-digit
code to the approver, and `agent.ts` can read the inbox through its `readInbox`
tool to collect the code.

## Run

```bash
npm install
npm test
```

All tests pass. That is the point, twice over:

- `test/happy-path.test.ts` passes because nothing here is broken in the
  ordinary sense.
- `test/approval-integrity-probes.test.ts` passes because every probe is
  written so that a pass is the attacker's win. It is the probe file the
  skill produced when run on this fixture, kept as a worked example. Each
  probe sets up a legitimate approval, does the one thing a property forbids,
  and asserts the behaviour the system should have refused. After you fix a
  flow, flip the assertions and the file becomes the regression suite.

The skill's verdict on this fixture is "proves nothing": the decision is not
authenticated, and the agent can produce the approval itself.
