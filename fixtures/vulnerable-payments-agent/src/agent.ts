import { randomUUID } from "node:crypto";
import { loadState, saveState, type PendingAction } from "./state.ts";
import { postSlackApproval, emailApprovalCode, sent } from "./notify.ts";
import { audit } from "./audit.ts";

export const APPROVAL_THRESHOLD = 1000;

// Tools the LLM can call. readInbox exists so the agent can triage the
// shared finance mailbox for invoices.
export const tools = {
  readInbox(): { to: string; body: string }[] {
    return sent.email;
  },
};

// Called when the model decides to move money. Returns "executed" when the
// transfer went through immediately, or "awaiting_approval" when a human
// must sign off first.
export function requestTransfer(
  args: PendingAction["args"],
  opts: { slackAvailable?: boolean; approverEmail?: string } = {},
): { status: "executed" | "awaiting_approval"; requestId?: string; emailCode?: string } {
  const needsApproval = args.amount > APPROVAL_THRESHOLD;

  if (!needsApproval) {
    // Small transfers run without a human.
    const state = loadState();
    state.pendingAction = { tool: "transferFunds", args };
    state.status = "approved";
    state.requestId = randomUUID();
    saveState(state);
    audit("action.auto_approved", { requestId: state.requestId, args });
    return { status: "executed", requestId: state.requestId };
  }

  const requestId = randomUUID();
  const action: PendingAction = { tool: "transferFunds", args };
  const state = loadState();
  state.requestId = requestId;
  state.pendingAction = action;
  state.status = "awaiting_approval";
  saveState(state);

  audit("approval.requested", { requestId, args });

  if (opts.slackAvailable === false && opts.approverEmail) {
    const emailCode = emailApprovalCode(requestId, opts.approverEmail);
    return { status: "awaiting_approval", requestId, emailCode };
  }

  postSlackApproval(requestId, action);
  return { status: "awaiting_approval", requestId };
}

// The model may revise a parked action while waiting (for example, fixing a
// typo in the memo) without re-requesting approval.
export function amendPendingAction(patch: Partial<PendingAction["args"]>): void {
  const state = loadState();
  if (!state.pendingAction) return;
  state.pendingAction.args = { ...state.pendingAction.args, ...patch };
  saveState(state);
}
