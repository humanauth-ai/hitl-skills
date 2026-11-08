# hitl: human-in-the-loop skills for AI agents

Two skills for agents that pause for a human before they move money, delete
data, send messages or change production. They teach the agent to ask one
question of any approval flow: **what does the approval prove?** The action,
a click, or nothing.

| Skill | What it does |
|---|---|
| `human-approval-audit` | Audits an agent's human-approval gates and reports what the approval proves. Scores six properties per gate (frozen action, authenticated and authorised decision, TTL and single use, policy outside the agent, durable evidence, verified before execution), writes probes in the repo's own test doubles, and ends with a verdict: proves the action, proves a click, or proves nothing. |
| `human-approval-gate` | Adds a human approval step that proves the action, in nine steps, then runs the audit on itself. |

Covers LangGraph `interrupt`, OpenAI Agents SDK `needs_approval`, Google ADK
`require_confirmation`, Vercel AI `needsApproval`, Claude Agent SDK
`canUseTool`, MCP elicitation, n8n Wait, Slack and email approve buttons, and
homegrown approval webhooks. Vendor-neutral: the audit scores HumanAuth's own
products with the same rubric, and its published report on them is in the
repository under `reports/`.

## Install

Claude Code: `/plugin marketplace add humanauth-ai/hitl-skills`, then
`/plugin install hitl@humanauth`. The skills appear as
`hitl:human-approval-audit` and `hitl:human-approval-gate`. Other agents that
read the Agent Skills format can copy the two folders under `skills/`.

## Use

In your agent, in the repo you want audited: "Audit our human approval flow.
What does the approval prove?" The audit reads code, runs read-only searches
(`references/find-gates.md`) and the repo's own tests. It never calls live
payment, email or production endpoints.

## Data handling

These skills are Markdown and reference files only. They run no scripts,
start no servers, and send nothing anywhere. Anything the agent runs while
following them is the repository's own test suite, under the agent's normal
permissions.

## Scope and ethics

Run these skills only on code you own or are authorised to test.

The repository that hosts this plugin also carries two fixture agents
(`fixtures/`) and the eval cases (`evals/`) used to measure the skills; they
live outside the plugin folder on purpose.

MIT licensed. Made by [HumanAuth](https://humanauth.ai).
