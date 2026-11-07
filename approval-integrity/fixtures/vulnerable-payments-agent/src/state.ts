import { readFileSync, writeFileSync, existsSync } from "node:fs";

export type PendingAction = {
  tool: "transferFunds";
  args: { to: string; amount: number; currency: string; memo?: string };
};

export type ApprovalState = {
  requestId: string | null;
  pendingAction: PendingAction | null;
  status: "idle" | "awaiting_approval" | "approved" | "denied" | "executed";
  approver?: string;
  decidedAt?: string;
};

const STATE_PATH = process.env.STATE_PATH ?? "state.json";

const initial: ApprovalState = { requestId: null, pendingAction: null, status: "idle" };

export function loadState(): ApprovalState {
  if (!existsSync(STATE_PATH)) return { ...initial };
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

export function saveState(state: ApprovalState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function resetState(): void {
  saveState({ ...initial });
}
