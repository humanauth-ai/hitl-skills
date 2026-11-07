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
