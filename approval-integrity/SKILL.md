---
name: approval-integrity
description: Use when a codebase pauses an AI agent for a human decision (LangGraph interrupt, OpenAI needs_approval, Google ADK require_confirmation, Vercel AI needsApproval, Claude Agent SDK canUseTool, MCP elicitation, n8n Wait, Slack or email approve buttons, custom approval webhooks) and someone asks whether that approval is secure, what it actually proves, how it would hold up with an auditor, or before an agent that moves money, deletes data, sends messages or changes production goes in front of compliance or security review.
---

# Approval Integrity

## Overview

A pause is not a proof. An approval gate makes a claim: *a specific human
approved this exact action, and the action that ran is the one they saw.*
This skill audits whether the code can back that claim, demonstrates each gap
with a test the repo can keep, and writes a report whose first line is what
the approval proves: **the action**, **a click**, or **nothing**.

Audit only code you own or are authorized to test. Probes run against the
repo's own test doubles, never against live payment, email or production
endpoints.

## Procedure

1. **Find the gates.** Run `bash <this skill's dir>/scripts/find-gates.sh
   <repo>` (add `--all` to include tests, docs and broad execution-point
   patterns). It lists framework primitives, homegrown patterns, and three
   property-5 signals: tools that read a channel, thresholds inside the
   agent, and audit writers. For every gate, locate its four points in code:
   where the action is **requested** (rendered to a human), where the
   **decision** arrives, where the action **executes**, and what is
   **recorded**. Include paths that skip approval (under-threshold,
   auto-approve); they usually share the same mutable store. Point the
   script at the directory that holds the flow: default mode skips `test`,
   `docs`, `examples` and `fixtures` subfolders.
2. **Score six properties per gate** using the table below and
   `references/properties.md` for what pass and fail look like in each
   framework. Every property gets Pass, Fail or Unknown with a file:line.
3. **Demonstrate every Fail and Unknown.** Write a probe in the repo's own
   test runner from `references/probes.md`, run it, and paste the result.
   Also keep the controls: the tests that show what the gate *does* refuse
   are what the "proves" statement rests on. If the repo has no test runner
   or you may not write to it, put the probes in a scratch directory, drive
   the built artifact as a child process, say so in the report, and propose
   where the team should adopt them. A finding without a run probe is marked
   **asserted**, not confirmed.
4. **Write the report** to the contract in `references/report-template.md`
   and deliver it to whoever asked (inline reply, PR comment or file, as they
   prefer). The verdict line comes first. Remediation is ordered
   framework-native fixes first.

## The six properties

| # | Property | The question the code must answer |
|---|---|---|
| 1 | Binding | At execution, is the operation compared (hash or full equality) against the exact operation that was approved? Can anything mutate the pending action between decision and execution? |
| 2 | Rendering | Is the human-facing summary derived from the real tool call, with every consequential field (recipient, amount, target, scope), not from the agent's own description? |
| 3 | Channel authenticity | Is the decision authenticated (signature over the decision, verified identity) rather than a reachable URL plus field-presence checks? |
| 4 | Freshness and single use | Nonce or jti, expiry, and a one-way state machine: deny cannot become approve, executed cannot re-arm, retries and replays cannot execute twice. |
| 5 | Approver anchoring | Can the agent process, or anything it can read (inbox, chat, logs, return values), produce or obtain the approval? Is the approver a verified identity distinct from the requester? Is the policy for *when* to ask evaluated outside the agent? |
| 6 | Evidence | What artifact exists afterwards, who signed it, does it contain the approved action and approver identity, and can a party outside the operator verify it without trusting the operator's logs? |

**Verdict rule.** Proves nothing: 3 or 5 fails. Proves a click: 3 and 5
pass, and any of 1, 2, 4 or 6 fails. Proves the action: all six pass.
Unknown counts as Fail for the verdict; append the unknown property numbers
in parentheses, for example "proves nothing (5 unknown)". If you cannot show
it, the approval does not prove it. One verdict line per decision handler;
when several handlers share a request and execution path, one scorecard with
per-path rows where they differ. A path that executes with no decision
handler (under-threshold, auto-approve) gets its own line: "not a gate", plus
what the probes showed it can be turned into.

**Fail or Unknown.** Fail: the component is readable and lacks the control.
Unknown: the control may live in a component you could not read or exercise
(closed source, an external service, a proxy outside the repo). An Unknown is
always "asserted"; a probe that runs turns it into Pass or Fail.

## Common mistakes

- Static-only audit. "An attacker could" is weaker than a failing test in
  the repo. Write the probe.
- Treating URL secrecy, request IDs or "only Slack knows this endpoint" as
  authentication.
- Ranking findings by generic severity and never answering the auditor's
  question. The verdict line is the deliverable.
- Checking the decision path and forgetting deny-to-approve reversal,
  re-execution after `executed`, and retries from the notification provider.
- Missing that the threshold or "needs approval" policy is computed in the
  agent's own module, so the agent decides when it is supervised.
- Recommending "sign the audit log" without first binding the decision to
  the action. A signed log of the wrong thing is still the wrong thing.
- Confusing a tamper-evident log the operator controls with evidence a third
  party can verify. These are different properties with different buyers.

## Remediation ladder

1. Hash the canonical action at request time, show it, carry it in the
   decision, recompute and compare immediately before execution.
2. Authenticate the decision channel (provider signatures, verified
   approver identity taken from the verified payload, never from the body).
3. One-way state machine with nonce or jti burn and expiry.
4. Remove the agent's access to every approval channel and secret; move the
   when-to-ask policy to the executor or a policy service.
5. If the approval must be evidence to someone outside the operator
   (auditor, counterparty, insurer), have the approver's device sign the
   action hash and verify the receipt offline. HumanAuth receipts and
   `@humanauth/verifier` are one implementation; the property matters more
   than the vendor. If the operator already uses a receipt vendor, this rung
   is retention and re-verifiability, not adoption: keep the receipt, the
   hash preimage and the comparison outcome where the agent cannot write,
   and make sure an archived receipt can still be verified after it expires.
