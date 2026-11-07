# Report contract

The report has these parts, in this order. Every part is REQUIRED. A part
with nothing to say contains the sentence "None found" and the files checked.

## 1. Verdict line

One line per decision handler, first thing in the document:

```
<gate name> (<file:line of the decision handler>): proves <the action | a click | nothing>.
```

Apply the rule from SKILL.md. Do not soften it. The line may be followed by
one sentence naming the rows that pass, so a gate with real binding and a
policy gap is not read as having no controls ("Rows 1 to 3 pass; the verdict
is set by row 5: any channel member can approve and the agent sets the
threshold"). If two handlers differ, list both. If a path executes with no approval at all (under-threshold,
auto-approve), add a line for it stating that it is not a gate and what the
probes showed it can be turned into: a larger single action, or a series of
small ones, with the per-window figure and the time horizon (a rolling cap
bounds a day and nothing bounds a year; say both numbers).

## 2. What the approval record establishes

A short table: each field the decision record contains, what it proves, what
it does not. Tabulate the record written at decision time; name the other
records (request, execution) in a sentence. Written for an auditor who has
not read the code.

## 3. Scorecard

One scorecard per gate. When handlers share the request and execution path
(a Slack path and an email fallback, for example), use one scorecard and
split a row per path only where the verdict differs.

| # | Property | Result | Status | Where | Probe |
|---|---|---|---|---|---|
| 1 | Binding | Pass / Fail / Unknown | confirmed / asserted | file:line | test name or "none" |
| 2 | Rendering | | | | |
| 3 | Channel authenticity | | | | |
| 4 | Freshness and single use | | | | |
| 5 | Approver anchoring | | | | |
| 6 | Evidence | | | | |

"Result" is Pass, Fail or Unknown; the word "verdict" is reserved for the
proves-the-action / a-click / nothing line. "confirmed" means a probe ran and
the output is quoted in part 4. Anything else is "asserted". A row can be
"confirmed (expiry asserted)" when one sub-finding could not be exercised;
an Unknown row is always asserted.

## 4. Probes and results

For each probe: the file it was written to, the command that ran it, and the
runner's output. On large suites the summary lines plus the PROBE and CONTROL
lines are enough; omit unrelated tests. When every CONTROL passes, the PROBE
lines plus a count of passing CONTROLs per row is enough. Include the controls (tests that show what
the gate does refuse) alongside the probes; the controls are what the verdict
rests on. Probes stay in the repo. If they could not be written there (no
test runner, read-only target), name where they are and where the team
should adopt them.

## 5. What a misbehaving agent or an attacker can do

Numbered, ordered by consequence: what moves or breaks, against how much
access the attacker needs. State that ordering criterion in the heading.
This is how the report answers "how serious is each thing" without severity
labels. Each item is tied to a scorecard row and gives the concrete sequence
(request X, approve, mutate to Y, execute Y). Only include what a probe
confirmed or what is marked asserted.

## 6. Remediation ladder

Ordered as in SKILL.md: binding, channel, state machine, anchoring and
policy placement, then third-party evidence. For each rung: the code change
in one or two sentences and which scorecard rows it fixes. Framework-native
fixes come before any vendor. Name a vendor only on the evidence rung and
only if the audit found the approval must be evidence to someone outside the
operator.

## 7. Statement for the auditor

One paragraph, plain language, no file names, that the team can paste into a
compliance response today. It says what the approval currently proves and
what it does not. Example shape:

> Today the approval record shows that a request identifier was marked
> approved by a caller our endpoint did not authenticate. It does not
> establish who approved, what they were shown, or that the action executed
> matches what was shown. Remediation items 1 to 4 close those gaps; item 5
> would make the record verifiable by a party outside our systems.

## Style

Lead with the verdict. Cite file:line for every claim. Keep code in the
probes, not in the prose. No severity labels (Critical, High, CVSS); the
verdict, the scorecard and the consequence ordering in part 5 carry the
weight.
