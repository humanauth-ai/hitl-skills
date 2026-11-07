import type { PendingAction } from "./state.ts";

// Mocked outbound channels. In the real system these call Slack and SES.
export const sent: { slack: string[]; email: { to: string; body: string }[] } = {
  slack: [],
  email: [],
};

export function postSlackApproval(requestId: string, action: PendingAction): void {
  // The Slack message summarises the action for the approver.
  const summary = `Approve transfer of ${action.args.amount} ${action.args.currency} to ${action.args.to}?`;
  sent.slack.push(`[${requestId}] ${summary}  (Approve) (Deny)`);
}

export function emailApprovalCode(requestId: string, approverEmail: string): string {
  // Fallback when Slack is unavailable: a 6-digit code the approver reads back.
  const code = String(Math.floor(100000 + Math.random() * 900000));
  sent.email.push({
    to: approverEmail,
    body: `Your approval code for request ${requestId} is ${code}. Reply with the code to approve.`,
  });
  return code;
}
