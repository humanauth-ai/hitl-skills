// Approval-integrity probes.
//
// Each test sets up a legitimate approval, does the one thing the property
// forbids, and asserts the behaviour the system SHOULD have refused. A probe
// that passes is evidence of the gap. After remediation, flip the assertions
// and these become the regression suite.
//
// Everything runs against the repo's own in-memory doubles (notify.ts `sent`,
// executor.ts `ledger`) and a temp state/audit directory. Nothing touches a
// live channel.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "vpa-probes-"));
process.env.STATE_PATH = join(dir, "state.json");
process.env.AUDIT_PATH = join(dir, "audit.log");

const { requestTransfer, amendPendingAction, tools, APPROVAL_THRESHOLD } = await import("../src/agent.ts");
const { handleApprovalCallback, handleEmailCode } = await import("../src/approvals.ts");
const { runApprovedActions, ledger } = await import("../src/executor.ts");
const { resetState, loadState, saveState } = await import("../src/state.ts");
const { sent } = await import("../src/notify.ts");
const { audit } = await import("../src/audit.ts");

function auditLines(): Record<string, any>[] {
  return readFileSync(process.env.AUDIT_PATH!, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

beforeEach(() => {
  resetState();
  ledger.length = 0;
  sent.slack.length = 0;
  sent.email.length = 0;
});

// ---------------------------------------------------------------------------
// Property 1: Binding. The executed operation must be the approved operation.
// ---------------------------------------------------------------------------

test("PROBE 1a binding: action amended AFTER approval still executes", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  amendPendingAction({ to: "attacker-ltd", amount: 5_000_000 });
  assert.equal(runApprovedActions(), true);
  // The human approved 5000 USD to acme-ltd. If this holds, binding FAILS.
  assert.deepEqual(ledger, [{ to: "attacker-ltd", amount: 5_000_000, currency: "USD" }]);
});

test("PROBE 1b binding: action amended BETWEEN render and approval executes the unseen version", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  // What the approver was shown in Slack:
  assert.match(sent.slack.at(-1)!, /5000 USD to acme-ltd/);
  amendPendingAction({ to: "attacker-ltd", amount: 5_000_000 });
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  assert.equal(runApprovedActions(), true);
  assert.deepEqual(ledger, [{ to: "attacker-ltd", amount: 5_000_000, currency: "USD" }]);
  // The Slack message was never re-issued for the amended action.
  assert.equal(sent.slack.length, 1);
});

test("PROBE 1c binding + policy: auto-approved small transfer amended to a huge one, no human ever asked", () => {
  const r = requestTransfer({ to: "coffee", amount: 40, currency: "USD" });
  assert.equal(r.status, "executed"); // agent is told it ran; it has not run yet
  amendPendingAction({ to: "attacker-ltd", amount: 5_000_000 });
  assert.equal(runApprovedActions(), true);
  assert.deepEqual(ledger, [{ to: "attacker-ltd", amount: 5_000_000, currency: "USD" }]);
  assert.equal(sent.slack.length, 0);
  assert.equal(sent.email.length, 0);
});

// ---------------------------------------------------------------------------
// Property 2: Rendering. The human sees the real action.
// ---------------------------------------------------------------------------

test("PROBE 2a rendering (Slack): summary is built from the tool args and carries to/amount/currency", () => {
  requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD", memo: "invoice 77" });
  const msg = sent.slack.at(-1)!;
  assert.match(msg, /5000/);
  assert.match(msg, /USD/);
  assert.match(msg, /acme-ltd/);
  // memo is not shown, but transferFunds does not consume it, so it is not consequential.
  assert.doesNotMatch(msg, /invoice 77/);
  // No action hash or canonical form is shown, so the approver cannot tie the
  // click to a specific action version (see probe 1b).
  assert.doesNotMatch(msg, /[a-f0-9]{32,}/);
});

test("PROBE 2b rendering (email): approval email contains no action content at all", () => {
  requestTransfer(
    { to: "acme-ltd", amount: 5000, currency: "USD" },
    { slackAvailable: false, approverEmail: "cfo@example.com" },
  );
  const body = sent.email.at(-1)!.body;
  assert.doesNotMatch(body, /5000/);
  assert.doesNotMatch(body, /acme-ltd/);
  assert.doesNotMatch(body, /USD/);
  assert.match(body, /approval code for request/);
});

// ---------------------------------------------------------------------------
// Property 3: Channel authenticity. The decision must be authenticated.
// ---------------------------------------------------------------------------

test("PROBE 3a channel: unsigned callback with an arbitrary approver string is accepted", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  const res = handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "anyone" });
  assert.equal(res.ok, true);
  assert.equal(runApprovedActions(), true);
  assert.equal(loadState().approver, "anyone");
});

test("PROBE 3b channel: email-code handler trusts the caller to supply the expected code", () => {
  const r = requestTransfer(
    { to: "acme-ltd", amount: 5000, currency: "USD" },
    { slackAvailable: false, approverEmail: "cfo@example.com" },
  );
  // The caller never needs the real code: `expected` is a parameter.
  const res = handleEmailCode(r.requestId!, "000000", "000000");
  assert.equal(res.ok, true);
  assert.equal(runApprovedActions(), true);
  assert.equal(loadState().approver, "email"); // no identity recorded
});

// ---------------------------------------------------------------------------
// Property 4: Freshness and single use.
// ---------------------------------------------------------------------------

test("PROBE 4a single-use: a denial is reversed by a later approve", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "deny", approver: "cfo@example.com" });
  assert.equal(loadState().status, "denied");
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "intern@example.com" });
  assert.equal(runApprovedActions(), true);
  assert.equal(ledger.length, 1);
});

test("PROBE 4b single-use: a replayed approval (provider retry) re-executes a completed transfer", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  const cb = { requestId: r.requestId!, decision: "approve" as const, approver: "cfo@example.com" };
  handleApprovalCallback(cb);
  assert.equal(runApprovedActions(), true);
  assert.equal(loadState().status, "executed");
  handleApprovalCallback(cb); // Slack retries on a slow 200
  assert.equal(runApprovedActions(), true);
  assert.equal(ledger.length, 2); // paid twice
});

test("PROBE 4c single-use: denial reversed through the email path too", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "deny", approver: "cfo@example.com" });
  assert.equal(handleEmailCode(r.requestId!, "x", "x").ok, true);
  assert.equal(runApprovedActions(), true);
});

test("PROBE 4d freshness: no field in state records when the request was made, and decidedAt is never read", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  const s = loadState();
  assert.equal("createdAt" in s, false);
  assert.equal("expiresAt" in s, false);
  // Backdate the decision by a year; the executor still runs it.
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  const stale = loadState();
  stale.decidedAt = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  saveState(stale);
  assert.equal(runApprovedActions(), true);
});

// ---------------------------------------------------------------------------
// Property 5: Approver anchoring. The agent must not be able to approve itself.
// ---------------------------------------------------------------------------

test("PROBE 5a anchoring: requestTransfer hands the approval code straight back to the agent", () => {
  const r = requestTransfer(
    { to: "acme-ltd", amount: 5000, currency: "USD" },
    { slackAvailable: false, approverEmail: "cfo@example.com" },
  );
  assert.match(r.emailCode!, /^\d{6}$/);
  assert.equal(handleEmailCode(r.requestId!, r.emailCode!, r.emailCode!).ok, true);
  assert.equal(runApprovedActions(), true);
});

test("PROBE 5b anchoring: agent reads the approver's code from the shared inbox tool", () => {
  const r = requestTransfer(
    { to: "acme-ltd", amount: 5000, currency: "USD" },
    { slackAvailable: false, approverEmail: "cfo@example.com" },
  );
  const inbox = tools.readInbox();
  const code = /is (\d{6})/.exec(inbox.at(-1)!.body)![1];
  assert.equal(handleEmailCode(r.requestId!, code, code).ok, true);
  assert.equal(runApprovedActions(), true);
});

test("PROBE 5c anchoring: agent process can post the Slack decision itself, naming the CFO as approver", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  // Same process, same import. Nothing distinguishes requester from approver.
  const res = handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  assert.equal(res.ok, true);
  assert.equal(runApprovedActions(), true);
  assert.equal(auditLines().find((l) => l.event === "approval.decided")!.approver, "cfo@example.com");
});

test("PROBE 5d anchoring: when-to-ask policy lives in the agent module; splitting defeats the threshold", () => {
  assert.equal(APPROVAL_THRESHOLD, 1000);
  for (let i = 0; i < 6; i++) {
    requestTransfer({ to: "acme-ltd", amount: 999, currency: "USD" });
    runApprovedActions();
  }
  assert.equal(ledger.reduce((s, e) => s + e.amount, 0), 5994);
  assert.equal(sent.slack.length, 0); // no human asked
});

// ---------------------------------------------------------------------------
// Property 6: Evidence. What exists afterwards, and who can check it.
// ---------------------------------------------------------------------------

test("PROBE 6a evidence: decision record carries no action content or hash", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  const decided = auditLines().find((l) => l.event === "approval.decided" && l.requestId === r.requestId)!;
  assert.equal(decided.args, undefined);
  assert.equal(decided.actionHash, undefined);
  assert.equal(decided.signature, undefined);
});

test("PROBE 6b evidence: after a swap, the log records the attacker's action as the executed-and-approved one", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  amendPendingAction({ to: "attacker-ltd", amount: 5_000_000 });
  runApprovedActions();
  const lines = auditLines().filter((l) => l.requestId === r.requestId);
  const requested = lines.find((l) => l.event === "approval.requested")!;
  const executed = lines.find((l) => l.event === "action.executed")!;
  assert.equal(requested.args.to, "acme-ltd");
  assert.equal(executed.args.to, "attacker-ltd");
  assert.equal(executed.approver, "cfo@example.com"); // CFO is now on record for 5M to attacker
  // Nothing in the log flags the mismatch.
  assert.equal(lines.some((l) => /mismatch|refused|reject/i.test(JSON.stringify(l))), false);
});

test("PROBE 6c evidence: the agent process can append forged records to the same plaintext log", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  audit("approval.decided", { requestId: r.requestId, decision: "approve", approver: "cfo@example.com" });
  const forged = auditLines().find((l) => l.event === "approval.decided" && l.requestId === r.requestId)!;
  assert.equal(forged.approver, "cfo@example.com");
  // No chain hash, no sequence number, no signature distinguishes it from a real record.
  assert.equal(forged.prevHash, undefined);
  assert.equal(forged.seq, undefined);
  assert.equal(forged.signature, undefined);
});
