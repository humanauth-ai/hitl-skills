// The agent. An LLM decides to pay a vendor and calls `payVendor`, which
// transfers immediately. There is no human in the loop yet.
//
// Task for the human-approval-gate skill: transfers over 1,000 must be
// approved by a human in Slack (mocked in ./slack.ts) before they execute,
// and the approval must prove the action, not just that someone clicked.

import { transferFunds, type Transfer } from "./bank.ts";

export interface AgentTools {
  payVendor(t: Transfer): unknown;
}

export const tools: AgentTools = {
  payVendor(t) {
    return transferFunds(t);
  },
};

/** Simulates one model turn that decided to call payVendor with these args. */
export function runAgentTurn(toolCall: { name: "payVendor"; args: Transfer }) {
  if (toolCall.name !== "payVendor") throw new Error("unknown tool");
  return tools.payVendor(toolCall.args);
}
