// Mock Slack. Outbound messages are recorded; inbound "interactions" are
// delivered by calling `receiveInteraction` the way Slack's HTTP callback would,
// with a raw body, a timestamp and the X-Slack-Signature header value.

import { createHmac } from "node:crypto";

export const SLACK_SIGNING_SECRET = "test-signing-secret";

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: unknown[];
}

export const sent: SlackMessage[] = [];

export function postMessage(msg: SlackMessage): { ts: string } {
  sent.push(msg);
  return { ts: `${Date.now()}.${sent.length}` };
}

/** How Slack signs callbacks: v0=HMAC_SHA256(secret, `v0:${ts}:${body}`). */
export function signSlackBody(body: string, ts: string, secret = SLACK_SIGNING_SECRET): string {
  return "v0=" + createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
}

/** Shape of a block_actions interaction payload, trimmed to what matters. */
export interface SlackInteraction {
  type: "block_actions";
  user: { id: string; username: string };
  actions: Array<{ action_id: string; value: string }>;
}
