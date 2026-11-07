import { loadState, saveState } from "./state.ts";
import { audit } from "./audit.ts";

export const ledger: { to: string; amount: number; currency: string }[] = [];

function transferFunds(args: { to: string; amount: number; currency: string }): void {
  ledger.push({ to: args.to, amount: args.amount, currency: args.currency });
}

// Polled by a worker. When the state says approved, run the pending action.
export function runApprovedActions(): boolean {
  const state = loadState();
  if (state.status !== "approved" || !state.pendingAction) return false;

  const action = state.pendingAction;
  if (action.tool === "transferFunds") {
    transferFunds(action.args);
  }

  audit("action.executed", {
    requestId: state.requestId,
    tool: action.tool,
    args: action.args,
    approver: state.approver,
  });

  state.status = "executed";
  saveState(state);
  return true;
}
