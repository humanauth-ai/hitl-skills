# Probes: demonstrate each gap as a test the repo keeps

A finding is **confirmed** only when a probe ran and showed the behavior. Write
probes in the repo's own test runner, against the repo's own test doubles.
Never point a probe at a live payment, email, messaging or production
endpoint. If the only way to exercise a path is live, mark the finding
**asserted** and say why.

Each probe follows the same shape: set up a legitimate approval, do the one
thing the property forbids, assert what the system should have refused.
A probe that *passes* in the attacker's favor is the evidence. Leave the
probes in the repo; after remediation they become the regression suite (flip
the assertions).

## One complete example (TypeScript, node:test)

Written against this skill's own fixture, `fixtures/vulnerable-payments-agent`
(`requestTransfer`, `amendPendingAction`, `handleApprovalCallback`,
`runApprovedActions`, a `ledger`). On any other repo the names, the state
reset and the way you reach the inbox will differ; the shape of each probe
is what transfers.

```ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import the repo's own modules; point state at a temp dir if it uses files.
const { requestTransfer, amendPendingAction } = await import("../src/agent.ts");
const { handleApprovalCallback } = await import("../src/approvals.ts");
const { runApprovedActions, ledger } = await import("../src/executor.ts");
const { resetState } = await import("../src/state.ts");

beforeEach(() => { resetState(); ledger.length = 0; });

// Property 1: Binding. Approve A, execute B.
test("PROBE binding: action amended after approval still executes", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  amendPendingAction({ to: "attacker-ltd", amount: 5_000_000 });
  runApprovedActions();
  // The human approved 5000 to acme-ltd. If this assertion holds, binding FAILS.
  assert.deepEqual(ledger, [{ to: "attacker-ltd", amount: 5_000_000, currency: "USD" }]);
});

// Property 1 and 5 together: take the path that needs no approval, then mutate it.
// Under-threshold and auto-approve paths usually share the pending store with
// the gated path, so a small approved action can be grown into a large one.
test("PROBE binding: auto-approved small action amended into a large one, no human asked", () => {
  requestTransfer({ to: "coffee", amount: 40, currency: "USD" });
  amendPendingAction({ to: "attacker-ltd", amount: 5_000_000 });
  runApprovedActions();
  assert.deepEqual(ledger, [{ to: "attacker-ltd", amount: 5_000_000, currency: "USD" }]);
});

// Property 3: Channel authenticity. Forge the yes.
test("PROBE channel: unsigned callback with any approver string is accepted", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  const res = handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "anyone" });
  assert.equal(res.ok, true); // no signature, no identity check
  assert.equal(runApprovedActions(), true);
});

// Property 4: Freshness and single use. Deny, then approve. Execute twice.
test("PROBE single-use: denial can be reversed by a later approve", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "deny", approver: "cfo@example.com" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  assert.equal(runApprovedActions(), true);
});

test("PROBE single-use: replayed approval re-executes a completed action", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  runApprovedActions();
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" }); // provider retry
  runApprovedActions();
  assert.equal(ledger.length, 2);
});

// Property 3, email path: the handler compares the code against a value the
// caller supplies, so the caller never needs the real code. Name this as its
// own finding; do not let it hide inside an anchoring probe.
test("PROBE channel: email handler trusts the caller to supply the expected code", async () => {
  const { handleEmailCode } = await import("../src/approvals.ts");
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" },
    { slackAvailable: false, approverEmail: "cfo@example.com" });
  assert.equal(handleEmailCode(r.requestId!, "000000", "000000").ok, true);
});

// Property 5: Approver anchoring. The agent reads its own approval code.
test("PROBE anchoring: agent can obtain the email approval code", async () => {
  const { tools } = await import("../src/agent.ts");
  const { handleEmailCode } = await import("../src/approvals.ts");
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" },
    { slackAvailable: false, approverEmail: "cfo@example.com" });
  const inbox = tools.readInbox();
  const code = /is (\d{6})/.exec(inbox.at(-1)!.body)![1];
  // Pass the real code as `expected` so this probe tests anchoring alone.
  assert.equal(handleEmailCode(r.requestId!, code, code).ok, true);
  assert.equal(runApprovedActions(), true);
});

test("PROBE anchoring: when-to-ask policy lives in the agent (threshold splitting)", () => {
  for (let i = 0; i < 6; i++) {
    requestTransfer({ to: "acme-ltd", amount: 999, currency: "USD" });
    runApprovedActions();
  }
  assert.equal(ledger.reduce((s, e) => s + e.amount, 0), 5994); // no human asked
});

// Property 6: Evidence. The decision record does not say what was approved.
test("PROBE evidence: decision record carries no action content", async () => {
  const { readFileSync } = await import("node:fs");
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  const lines = readFileSync(process.env.AUDIT_PATH!, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  // Filter by requestId: the log is shared across tests in one process.
  const decided = lines.find((l) => l.event === "approval.decided" && l.requestId === r.requestId);
  assert.equal(decided.args, undefined);
  assert.equal(decided.actionHash, undefined);
});
```

## Adapting to other stacks

- **pytest:** same shape; use a fixture for state reset; import the graph or
  agent module directly. For LangGraph, drive `graph.invoke` to the
  interrupt, then `graph.invoke(Command(resume=...))` with a mutated payload
  and assert on the side effect.
- **OpenAI Agents SDK:** serialize `RunState` after the interruption, mutate
  the pending tool call's arguments in the serialized form, deserialize,
  approve, resume. If the tool runs the mutated args, binding fails.
- **Google ADK:** supply the confirmation from a second agent or a raw event
  rather than the user channel.
- **Webhook flows (Slack, Teams, n8n):** post the callback body without the
  provider signature header. Post it twice. Post `deny` then `approve`.
- **Vendor services (HITL.sh, gotoHuman, HumanAuth):** probe your receiver.
  Post an unsigned callback to your own endpoint. If the vendor signs,
  verify your code actually checks the signature and the action hash, not
  just that the request parsed.

## Recipe for signed-receipt vendors

When the gate verifies a vendor's signed receipt, probe the relying party
with receipts you mint yourself. Most verifier SDKs ship test fixtures or
accept a JWKS URL you can point at a local key.

1. Serve a local JWKS and start the relying party against it (child process
   if the repo is read-only). Mint a legitimate receipt for a legitimate plan
   and confirm the happy path. That is control 1.
2. **Binding:** keep the receipt, change every request field the plan hash
   does not cover (image, replicas, commit). If the action still runs, the
   hash covers a description, not the action. Try type coercion (arrays,
   numbers as strings) and delimiter ambiguity in any templated string.
3. **Decision bit:** take a *denied* receipt, flip its result to approved,
   re-sign the envelope with the service key, keep the device signature. If
   it verifies, the device never signed the decision.
4. **Identity:** make the service-asserted subject differ from the
   device-signed approver. See which one the relying party records.
5. **Single use:** present a used receipt after restarting the relying
   party. In-memory replay stores forget.
6. **Anchoring:** mint with a different enrolled identity. If accepted, the
   relying party has no approver policy. Check whether the agent's own
   credential can enrol approvers.
7. **Evidence:** after a run, list what the operator still holds. Then try
   to re-verify an archived receipt after its expiry. If the verifier has no
   audit mode, the evidence has a shelf life of minutes.

## Property 2 (rendering) is usually a reading probe

Diff the fields the executor consumes against the fields in the human-facing
message. Any consequential field missing, truncated or formatted after the
message was built is the finding. If the message is built from model prose,
quote the line.
