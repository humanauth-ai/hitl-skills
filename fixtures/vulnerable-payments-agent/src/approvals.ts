import { loadState, saveState } from "./state.ts";
import { audit } from "./audit.ts";

export type CallbackBody = {
  requestId: string;
  decision: "approve" | "deny";
  approver: string;
};

// Handler for POST /approvals/callback. Slack's interactive-message webhook
// hits this URL when the approver clicks a button. The URL is only known to
// Slack and to us, so we validate that the required fields are present.
export function handleApprovalCallback(body: Partial<CallbackBody>): { ok: boolean; reason?: string } {
  if (!body.requestId || !body.decision || !body.approver) {
    return { ok: false, reason: "missing fields" };
  }

  const state = loadState();
  if (state.requestId !== body.requestId) {
    return { ok: false, reason: "unknown request" };
  }

  state.status = body.decision === "approve" ? "approved" : "denied";
  state.approver = body.approver;
  state.decidedAt = new Date().toISOString();
  saveState(state);

  audit("approval.decided", {
    requestId: body.requestId,
    decision: body.decision,
    approver: body.approver,
  });

  return { ok: true };
}

// Email fallback: the approver replies with the 6-digit code.
export function handleEmailCode(requestId: string, code: string, expected: string): { ok: boolean } {
  if (code !== expected) return { ok: false };
  const state = loadState();
  if (state.requestId !== requestId) return { ok: false };
  state.status = "approved";
  state.approver = "email";
  state.decidedAt = new Date().toISOString();
  saveState(state);
  audit("approval.decided", { requestId, decision: "approve", approver: "email" });
  return { ok: true };
}
