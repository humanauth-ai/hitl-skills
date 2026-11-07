# approval-integrity

An agent skill that audits the human-approval gates in an AI-agent codebase
and answers one question: **what does the approval actually prove?**

It finds the gates (LangGraph `interrupt`, OpenAI `needs_approval`, Google ADK
`require_confirmation`, Vercel AI `needsApproval`, Claude Agent SDK
`canUseTool`, MCP elicitation, n8n Wait, Slack and email approve buttons,
homegrown webhooks), scores six properties per gate, writes a probe test for
every gap in your own test runner, and produces a report whose first line is
one of:

- proves **the action**
- proves **a click**
- proves **nothing**

The properties come from 2026 security research on approval bypass: the
Loopjacking paper (arXiv 2609.21081), Google ADK's self-approval issues,
Microsoft's AI red-team taxonomy, Trail of Bits' argument-injection work, and
the Cornell/Yale spend-cap study. The skill does not ship exploits. Probes run
against your repo's own test doubles and stay in your repo as the regression
suite once you fix things.

## Install

Claude Code, per project:

```bash
mkdir -p .claude/skills
cp -r skills/approval-integrity .claude/skills/
```

Claude Code, for every project: copy to `~/.claude/skills/approval-integrity`.
Other agents that read the open skills format (`SKILL.md` with frontmatter)
work the same way; Codex, Copilot CLI and Gemini CLI also read
`~/.agents/skills/`.

## Use

In your agent, in the repo you want audited:

> Audit our human approval flow with the approval-integrity skill. What does
> the approval prove?

Or try it on the included fixture first:

```bash
cd skills/approval-integrity/fixtures/vulnerable-payments-agent
npm test   # 21 passing: 3 happy-path tests, 18 probes that pass in the attacker's favour
```

then ask your agent to audit that directory (delete the probe file first if
you want the agent to derive the probes itself). Expect "proves nothing".

When the skill was run blind on HumanAuth's own `examples/deploy-approval-gate`
it returned "proves a click", with the gaps listed. That report is the
standard the skill holds everyone to, including its author.

## Layout

```
SKILL.md                      procedure, six properties, verdict rule
scripts/find-gates.sh         locate gates in a repo (read-only)
references/properties.md      pass/fail per property, per framework
references/probes.md          probe templates (one complete example)
references/report-template.md the report contract
fixtures/vulnerable-payments-agent/   a flow that fails every property
```

## Scope and ethics

Run it only on code you own or are authorized to test. The skill tells the
agent never to point a probe at a live payment, email, messaging or
production endpoint. Findings without a run probe are reported as asserted,
not confirmed.

## Who made this

[HumanAuth](https://humanauth.ai) builds signed, device-bound approval
receipts for AI agents. The skill recommends framework-native fixes first and
mentions HumanAuth only on the last rung of the remediation ladder, where the
approval has to be evidence for someone outside your organisation. Nothing in
the skill phones home.

License: Apache-2.0.
