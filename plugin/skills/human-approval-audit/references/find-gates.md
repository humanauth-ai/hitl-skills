# Finding the gates

Locate every human-approval gate in an agent codebase before scoring it.
Read-only. Run the searches below from the directory that holds the flow.

## Run

With ripgrep (preferred):

```
rg -n --no-heading --hidden --max-columns 160 \
  --glob '!**/node_modules/**' --glob '!**/.git/**' --glob '!**/dist/**' \
  --glob '!**/build/**' --glob '!**/coverage/**' --glob '!**/vendor/**' \
  --glob '!**/.venv/**' --glob '!**/venv/**' --glob '!**/target/**' \
  --glob '!**/test/**' --glob '!**/tests/**' --glob '!**/__tests__/**' \
  --glob '!**/docs/**' --glob '!**/fixtures/**' --glob '!**/examples/**' \
  --glob '!*.md' --glob '!*.json' --glob '!*.lock' --glob '!*.test.*' --glob '!*.spec.*' \
  -e '<regex from the table>' .
```

With grep: `grep -rnE --exclude-dir={node_modules,.git,dist,build,coverage,vendor,.venv,venv,target,test,tests,__tests__,docs,fixtures,examples} -e '<regex>' .`

Run one search per row, prefix each hit with the row's label, sort and
de-duplicate, then count hits per label. For a second pass that includes
tests, docs and the broad execution-point row, drop the test/docs/fixtures
exclusions and the `*.md`/`*.json` globs.

## Patterns

Case-sensitive extended regular expressions.

| Label | Regex |
|---|---|
| langgraph-interrupt | `\binterrupt\s*\(` |
| langgraph-resume | `Command\s*\(\s*resume\|\.resume\s*\(` |
| openai-agents | `needs_approval\|require_approval\|\binterruptions\b\|RunState\|\.approve\s*\(\|\.reject\s*\(` |
| google-adk | `require_confirmation\|requireConfirmation\|ToolConfirmation` |
| vercel-ai | `addToolApprovalResponse\|tool-approval` |
| approval-flag | `needsApproval\|requireApproval\|requiresApproval\|needs_human\|requires_human` |
| claude-agent-sdk | `canUseTool\|PermissionRequest\|permission_request` |
| mcp-elicitation | `\belicit(ation\|Input)?\s*\(\|ElicitRequest\|elicitation/create` |
| crewai | `human_input\s*=\|HumanInputTask\|ask_human` |
| autogen | `UserProxyAgent\|human_input_mode` |
| humanlayer | `humanlayer\|human_as_tool` |
| gotohuman | `gotohuman\|goto_human` |
| hitl-vendor | `hitl\.sh\|pushary\|humanauth\|permissionprotocol` |
| n8n | `sendAndWait\|Send and Wait\|waitForWebhook\|"type":\s*"n8n-nodes-base\.wait"` |
| slack-interactive | `interactive_message\|block_actions\|[Xx]-[Ss]lack-[Ss]ignature\|signing_secret\|signingSecret` |
| teams-adaptive | `adaptiveCard\|AdaptiveCard` |
| email-code | `approval code\|verification code\|\bOTP\b\|one[- ]time code\|emailApprovalCode\|handleEmailCode` |
| approval-state | `awaiting_approval\|pending_approval\|pendingAction\|pending_action\|approval_required\|requires_human\|human_review\|review_required\|needs_human\|AWAITING_APPROVAL\|PENDING_APPROVAL` |
| approval-handler | `handleApproval\|approvalCallback\|onApprove\|approveRequest\|approve_request\|ApprovalDecision\|receive[A-Za-z]*Interaction\|handle[A-Za-z]*Interaction\|decision\s*[:=]\s*["'](approve\|deny)` |
| approval-route | `/approv(e\|al\|als)\b\|/callback\b\|/decision\b\|/review\b` |
| amend-pending (property 1) | `amendPending\|amend_pending\|updatePending\|update_pending\|patchPending\|patch_pending\|pendingAction\.args\s*=\|pending_action\[\|setPendingAction\|editPending` |
| agent-reads-channel (property 5) | `readInbox\|read_inbox\|listMessages\|list_messages\|conversations\.history\|gmail\|imap\|readSlack\|read_slack\|fetchMail\|get_messages\|readEmail\|read_email` |
| when-to-ask-policy (property 5) | `THRESHOLD\|threshold\s*[:=]\|needsApproval\s*=\|needs_approval\s*=\|requiresApproval\s*=\|> *[0-9_]{3,}\s*(;\|\)\|$)` |
| secret-fallback | `process\.env\.[A-Z_]*(SECRET\|KEY\|TOKEN)[A-Z_]*\s*(\?\?\|\|\|)\s*("[^"]+"\|'[^']+'\|` + "`[^`]+`" + `\|[A-Za-z_][A-Za-z0-9_.]*)` |
| audit-writer | `appendFileSync\|audit\.log\|audit\s*\(\|auditLog\|audit_log\|writeAudit` |
| execution-point (second pass only) | `\btransfer(Funds\|Money)?\s*\(\|\bpayout\s*\(\|\.delete(Many\|One)?\s*\(\|rm -rf\|DROP TABLE\|\bsendEmail\s*\(\|\bsend_mail\s*\(\|\bdeploy\s*\(` |

In the table the alternation bar is written `\|` so it survives Markdown;
type it as a plain `|` in the regex.

## What to do with the hits

For each gate, find its four points: where the action is **requested**
(rendered to a human), where the **decision** arrives, where the action
**executes**, and what is **recorded**. The property-1 row finds code that
rewrites a pending action after it was requested. The property-5 rows find
tools that read the approval channel, where the when-to-ask policy lives,
and secrets that fall back to a compiled-in constant. Then score the six
properties in SKILL.md.

A maintained shell version of this search ships in the repository at
`scripts/find-gates.sh` (outside the plugin, because the directory accepts
only text files from this publisher); it is a convenience, not a dependency.
