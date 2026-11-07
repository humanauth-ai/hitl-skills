# Eval results

Run with `claude plugin eval . --trust-plugin --scaffold --allow-tools Write Edit Bash`
from the plugin root. Each case runs three times with the plugin and three
times without; Δ is what the plugin adds. Judge model: sonnet. Raw JSON and
the HTML report are written under `results/` (not committed).

## Run 1, 2026-11-07, plugin v0.1.0

| Case | With | Without | Δ | Notes |
|---|---|---|---|---|
| audits-payments-agent | 0.75 | 0.42 | +0.33 | All three with-runs wrote and ran probes and fired the skill. Two compressed the final reply into a summary instead of the report contract, and one of those never used the words "proves nothing". Without the plugin, no run produced a verdict or the report shape. |
| slack-button-forgery | 1.00 | 0.33 | +0.67 | With the plugin, every run demonstrated forgery and replay with run tests, raised binding unprompted, and gave a verdict. Without it, runs ran tests but described the attacks in prose and gave no verdict. |
| ignores-unrelated-request | 1.00 | 1.00 | 0 | The skill never fired on a date-formatting request. |

Suite: 3 cases, mean Δ +0.33, 411 s, $5.99 list price.

Change made from this run: SKILL.md step 4 now states that the reply itself
is the report in the contract's order, with the verdict line in the exact
words, even when the asker phrased the request casually or the report is
also saved to a file. Run 2 re-checks the first case.

## Run 2, 2026-11-07, after the step 4 change (single arm, first case only)

| Case | With | Runs | Notes |
|---|---|---|---|
| audits-payments-agent | 1.00 | 3/3 perfect | Every run fired the skill, wrote and ran probes, opened with "proves nothing", and matched the report rubric. |

123 s, $1.77 list price. Against run 1's without-arm (0.42) the delta for this
case is now +0.58.

## Run 3, 2026-11-07, plugin v0.2.0 (both skills, four cases, with and without)

| Case | With | Without | Δ | Notes |
|---|---|---|---|---|
| audits-payments-agent | 0.92 | 0.50 | +0.42 | Three with-runs fired the skill, wrote and ran probes, opened with "proves nothing"; one failed the report rubric. Without the plugin every run wrote attack tests but none gave a verdict or the report shape. |
| slack-button-forgery | 1.00 | 0.33 | +0.67 | Unchanged from run 1. |
| builds-approval-gate | 1.00 | 0.67 | +0.33 | With the skill, every run's closing summary named at least six of the eight controls (binding, signed callback, approver allowlist, TTL and durable single use, policy outside the agent with aggregates, escaped rendering, linked record, stated target). Without it, every run built a signed-callback gate with a frozen copy and single use, and stopped there: no TTL, no approver policy, no aggregate, no durable record. |
| ignores-unrelated-request | 1.00 | 1.00 | 0 | Neither skill fired on a date-formatting request. |

Suite: 4 cases, mean Δ +0.35, 706 s, $9.90 list price.

## Gate skill validation, 2026-11-07 (subagent runs, scored by the audit skill)

Target: `fixtures/ungated-payments-agent`. Each build was audited by a fresh
agent running `human-approval-audit`; the verdict is the oracle.

| Build | Prompt | Skill | Audit verdict |
|---|---|---|---|
| A | "production-grade, this is money" | none | proves a click (row 2: mrkdwn injection, click not bound to the rendered message; also currency-blind threshold, fallback secret under non-production `NODE_ENV`, unkeyed audit chain) |
| B | "security review coming, nobody should fake an approval" | none | proves a click (row 6: per-process signing key, nothing persisted; also no aggregate limit, fallback secret, mrkdwn injection) |
| C | "keep it simple, add a test" | none | proves nothing (row 5: threshold in the agent's tool, any Slack user can approve; row 4: no TTL; row 6: in-memory record) |
| D | same as C | human-approval-gate | **proves the action, operator-grade evidence** (caveats accepted in writing: gate shares the agent's process, chain tail truncation needs an external anchor) |

What the builds without the skill dropped became the skill's "Defaults that
get dropped" table; what the audits found unclear became changes to the
audit skill's properties.md and SKILL.md.
