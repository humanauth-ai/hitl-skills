# hitl: human-in-the-loop skills for AI agents

Skills for agents that pause for a human before they move money, delete
data, send messages or change production. Open
[Agent Skills](https://agentskills.io) format, one plugin, install once.

| Skill | What it does | Status |
|---|---|---|
| [`human-approval-audit`](./skills/human-approval-audit) | Audits an agent's human-approval gates and reports what the approval proves: **the action**, **a click**, or **nothing**. Writes probes the repo keeps. | v0.1.0 |
| `human-approval-gate` | Builds a gate that passes the audit, framework by framework. | planned |

Covers LangGraph `interrupt`, OpenAI Agents SDK `needs_approval`, Google ADK
`require_confirmation`, Vercel AI `needsApproval`, Claude Agent SDK
`canUseTool`, MCP elicitation, n8n Wait, Slack and email approve buttons, and
homegrown approval webhooks.

## Install

**Claude Code**

```
/plugin marketplace add humanauth-ai/hitl-skills
/plugin install hitl@humanauth
```

Skills then appear as `hitl:human-approval-audit`.

**Codex** (reads this marketplace directly)

```
codex plugin marketplace add humanauth-ai/hitl-skills
codex plugin add hitl@humanauth
```

**Cursor, Gemini CLI, Copilot, OpenCode and 70+ other agents**

```
npx skills add humanauth-ai/hitl-skills
```

**By hand**: copy a folder from `skills/` into `.claude/skills/`,
`~/.claude/skills/` or `~/.agents/skills/`.

## Use

In your agent, in the repo you want audited:

> Audit our human approval flow. What does the approval prove?

Or try it on the included fixture first:

```bash
cd fixtures/vulnerable-payments-agent
npm test   # 21 passing: 3 happy-path tests, 18 probes that pass in the attacker's favour
```

then ask your agent to audit that directory (delete the probe file first if
you want the agent to derive the probes itself). Expect "proves nothing".

When the audit skill was run blind on HumanAuth's own deploy-approval example
it returned "proves a click", with the gaps listed. That report is the
standard the skill holds everyone to, including its author.

## Why "what does the approval prove?"

A pause is not a proof. 2026 security research (the Loopjacking paper, arXiv
2609.21081; Google ADK's self-approval issues; Microsoft's AI red-team
taxonomy; the Cornell/Yale spend-cap study) shows approval flows that pause
correctly and still let the agent change the action after the click, forge
the click, replay it, or read its own approval code. The audit scores six
properties per gate (binding, rendering, channel authenticity, freshness and
single use, approver anchoring, evidence) and demonstrates each gap with a
test in your own runner.

## Does the skill actually help?

We measure it with `claude plugin eval`, which runs each case with and
without the plugin. Latest numbers are in [`evals/RESULTS.md`](./evals/RESULTS.md):
on the core audit case the plugin took the score from 0.42 to 1.00; on the
"can someone fake the click?" phrasing from 0.33 to 1.00; and it never fired
on an unrelated request. The suite is in `evals/` so you can re-run it.

## Layout

```
.claude-plugin/              plugin and marketplace manifests
skills/human-approval-audit/
  SKILL.md                   procedure, six properties, verdict rule
  scripts/find-gates.sh      locate gates in a repo (read-only)
  references/properties.md   pass/fail per property, per framework
  references/probes.md       probe templates (one complete example)
  references/report-template.md   the report contract
  agents/openai.yaml         display metadata for Codex and ChatGPT
fixtures/vulnerable-payments-agent/   a flow that fails every property, with its probes
fixtures/ungated-payments-agent/      a flow with no approval yet (target for the gate skill)
evals/                                claude plugin eval cases and results
```

## Scope and ethics

Run these skills only on code you own or are authorised to test. Probes run
against the repository's own test doubles, never against live payment,
messaging or production endpoints. Findings without a run probe are reported
as asserted, not confirmed. Nothing here phones home, needs an account, or
installs anything beyond the skill files.

## Who made this

[HumanAuth](https://humanauth.ai) builds action-bound, device-signed approval
receipts for AI agents. The skills are vendor-neutral: they recommend
framework-native fixes first and mention HumanAuth only on the last rung of
the remediation ladder, where the approval has to be evidence for someone
outside your organisation.

MIT licensed.
