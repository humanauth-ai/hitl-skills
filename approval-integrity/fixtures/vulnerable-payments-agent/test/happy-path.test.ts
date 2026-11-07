import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "vpa-"));
process.env.STATE_PATH = join(dir, "state.json");
process.env.AUDIT_PATH = join(dir, "audit.log");

const { requestTransfer } = await import("../src/agent.ts");
const { handleApprovalCallback } = await import("../src/approvals.ts");
const { runApprovedActions, ledger } = await import("../src/executor.ts");
const { resetState } = await import("../src/state.ts");

beforeEach(() => {
  resetState();
  ledger.length = 0;
});

test("large transfer waits for approval, then executes", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  assert.equal(r.status, "awaiting_approval");
  assert.equal(runApprovedActions(), false);

  const cb = handleApprovalCallback({ requestId: r.requestId!, decision: "approve", approver: "cfo@example.com" });
  assert.equal(cb.ok, true);

  assert.equal(runApprovedActions(), true);
  assert.deepEqual(ledger, [{ to: "acme-ltd", amount: 5000, currency: "USD" }]);
});

test("denied transfer never executes", () => {
  const r = requestTransfer({ to: "acme-ltd", amount: 5000, currency: "USD" });
  handleApprovalCallback({ requestId: r.requestId!, decision: "deny", approver: "cfo@example.com" });
  assert.equal(runApprovedActions(), false);
  assert.deepEqual(ledger, []);
});

test("small transfer executes without approval", () => {
  const r = requestTransfer({ to: "coffee", amount: 40, currency: "USD" });
  assert.equal(r.status, "executed");
  assert.equal(runApprovedActions(), true);
  assert.deepEqual(ledger, [{ to: "coffee", amount: 40, currency: "USD" }]);
});
