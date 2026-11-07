---
name: human-approval-gate
description: Use when adding or hardening a human approval step (human-in-the-loop, confirmation, "ask a human before X") in front of an AI agent's consequential action such as moving money, deleting data, deploying, sending outbound messages or changing permissions, in any framework (LangGraph interrupt, OpenAI Agents SDK needs_approval, Google ADK require_confirmation, Vercel AI needsApproval, Claude Agent SDK canUseTool, MCP elicitation, n8n Wait, Slack, Teams or email buttons, custom webhooks) or plain code, including after an audit said the approval "proves a click" or "proves nothing".
---

# Human approval gate

## Overview

A gate is a claim: *a specific, authorised human approved this exact action,
and the action that ran is the one they saw.* Build it so the claim can be
proved, then prove it. The finished gate is one the `human-approval-audit`
skill in this plugin scores at the verdict you chose before writing code.
Without that last step you have built a pause, not a proof.

The framework's pause primitive (`interrupt`, `needs_approval`,
`require_confirmation`, a Slack button) is the *request* point. Four of the
six properties live elsewhere: in what delivers the yes, in your store, and
in where the policy runs. `references/recipes.md` says where each piece goes
per framework.

## Procedure

1. **Decide the claim.** Who has to believe this approval afterwards? Only
   your own team: target verdict "proves the action" at operator-grade
   evidence. An auditor, counterparty, regulator or insurer: the same verdict
   at third-party grade (approver-signed receipt). Write the target and the
   grade in the PR description first; step 9 checks against it.
2. **Place the gate where the agent cannot walk around it.** One gate module
   owns validation, the snapshot, the policy, the request, the decision
   handler, execution and the record. The agent's tool calls the gate and
   receives `{request_id, status}` and nothing else: no code, no secret, no
   record object, no method that changes a request's state. The agent module
   must not import the executor. Secrets, keys and configuration belong to
   the gate; in production the gate is its own process or service.
3. **Freeze and hash the action.** Validate the untrusted arguments into a
   typed struct: allowlisted fields only, unknown fields rejected, amounts as
   positive integers in minor units with a normalised currency, identifiers
   matched against a pattern. Freeze a canonical copy and hash it
   (SHA-256 over canonical JSON). The hash travels in the message, in the
   button or resume payload and in the decision record; immediately before
   execution recompute it from the frozen copy and compare. Execute the
   frozen copy, never a value read from mutable state after approval.
4. **Render from the frozen copy, escaped, and bind the click to the
   message.** One row per field the executor consumes, with the request id
   and a hash prefix, nothing from the model's prose. Escape each value for
   the surface (Slack mrkdwn, Teams and email HTML), or render values as
   plain text fields, so an agent-chosen recipient or memo cannot become a
   link label or a fake amount line. Store the message id the gate posted
   (Slack `ts` and channel) and refuse a decision whose callback names a
   different message: otherwise a decoy message carrying a real
   `request_id|hash` collects a genuine click.
5. **Authenticate the decision and authorise the decider.** Verify the
   provider's signature over the raw bytes within its timestamp window; take
   the approver identity from the verified payload, never from a body field.
   Fail closed when the secret is missing: a missing environment variable
   throws at startup, it does not fall back to a constant. Then apply an
   approver policy: an explicit allowlist or role, excluding the requester
   and every identity the agent itself holds. Verified is not authorised.
6. **State machine and time.** Record `created_at` and give requests a TTL in
   minutes. Transitions: awaiting to approved, denied or expired; approved to
   executed exactly once. Writes are compare-and-set or single-writer. A
   provider retry of the same decision is acknowledged without re-executing.
   The store is durable (file, SQLite, database), not a Map, so single-use
   survives a restart.
7. **Policy outside the agent.** The gate decides when to ask, on the
   normalised value (per-currency limits or a reference currency), with
   aggregate limits per recipient and per window and a count of unapproved
   executions, so N small actions cannot replace one large one and a
   different unit or a negative sign cannot slip under the line. Key the
   per-recipient limit on a bank-level identifier, or at least an
   NFKC-normalised string with punctuation and format characters stripped,
   so `acme-ltd.` is not a fresh recipient. The path that skips approval is
   bounded by policy, not by the agent's judgement.
8. **Evidence at the chosen grade.** Operator grade: an append-only store the
   agent process cannot write to, holding the request (frozen copy and hash),
   the decision (approver, decision, provider evidence such as the retained
   signature and timestamp), the pre-execution comparison outcome and the
   execution result with its transaction id; the ledger entry carries the
   request id back. A hash chain is tamper-evident only if it is keyed
   (HMAC or signature) with a key the writing process cannot read back, or
   its heads are anchored somewhere else; an unkeyed chain is re-forged by
   whoever can rewrite the file. If records are signed, the key is stable,
   loaded from outside the agent process, its public half published, one
   key id per key. Third-party grade: the approver's device signs the action hash and
   the decision bit, the service countersigns, and a relying party verifies
   offline against a published key. HumanAuth receipts and
   `@humanauth/verifier` are one implementation; the property matters more
   than the vendor.
9. **Prove it.** Run the `human-approval-audit` skill on the result before
   calling it done. Done means its verdict line equals the target from step
   1; its probes stay in the repository as the regression suite. If it says
   "a click" or "nothing", its remediation ladder is the remaining work.

## Defaults that get dropped

Observed on gates built without this skill, including ones built with
hashing and signature checks already in place:

| Dropped | What it allows | Default |
|---|---|---|
| Request TTL | a button in channel history clicked a month later | 15 minutes, `created_at` on the record |
| Approver allowlist | any channel member approves | explicit set; requester and agent identities excluded |
| Aggregate policy | six payments of 999 with no human asked | per-recipient and per-window sums, unapproved-count cap |
| Normalised amount | 999 BTC or -5,000,000 passes a `<= 1000` check | positive integer minor units, base currency |
| Escaping | memo draws a bold fake amount line | escape per surface, one field per row |
| Fail-closed secret | `process.env.X ?? "test-secret"`, or a fallback gated on `NODE_ENV` | throw at startup whenever a real channel is configured |
| Message binding | a decoy message with real button values collects a genuine click | store the posted message id, compare on callback |
| Keyed audit chain | unkeyed sha256 chain re-forged by whoever edits the file | HMAC or signature with a key outside the process |
| Recipient normalisation | `acme-ltd`, `acme-ltd.`, `acme‐ltd` each get a fresh cap | bank-level id, or NFKC plus strip punctuation |
| Durable store | restart forgets claims and records | SQLite or database from day one |
| Key custody | per-process key under one key id | stable key, published, one id per key |
| Record to execution link | ledger says nothing about the approval | transaction id in the record, request id in the ledger |
| Gate placement | agent imports the executor | only the gate module does |

## Common mistakes

- Treating the pause as the gate. The pause is the request point; the
  decision channel, the policy and the record are where approvals fail.
- Rendering the approval message from the model's own description.
- Shipping the in-memory store because it was convenient in tests.
- Reading "verified identity" as "authorised approver".
- Hashing a sentence ("Deploy web to us-east-1") instead of the struct.
- Declaring done without running the audit, or running it and arguing with
  the verdict instead of climbing the ladder.
