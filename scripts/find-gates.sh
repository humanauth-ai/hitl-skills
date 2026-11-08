#!/usr/bin/env bash
# Locate human-approval gates in an agent codebase.
# Usage: bash scripts/find-gates.sh <repo-dir> [--all]
#   default: source files only, tests/docs excluded, identifier-shaped patterns
#   --all:   also scan tests and docs, and add broad "execution point" patterns
# Output: summary of hits per label, then "<label>\t<file>:<line>:<match>",
# with file paths relative to <repo-dir>.
# Read-only. Uses ripgrep when available, falls back to grep.

set -euo pipefail

root="${1:-.}"
mode="${2:-}"
if [ ! -d "$root" ]; then
  echo "not a directory: $root" >&2
  exit 1
fi

# label|regex  (case-sensitive unless noted; extended regex)
patterns=(
  'langgraph-interrupt|\binterrupt\s*\('
  'langgraph-resume|Command\s*\(\s*resume|\.resume\s*\('
  'openai-agents|needs_approval|require_approval|\binterruptions\b|RunState|\.approve\s*\(|\.reject\s*\('
  'google-adk|require_confirmation|requireConfirmation|ToolConfirmation'
  'vercel-ai|addToolApprovalResponse|tool-approval'
  'approval-flag|needsApproval|requireApproval|requiresApproval|needs_human|requires_human'
  'claude-agent-sdk|canUseTool|PermissionRequest|permission_request'
  'mcp-elicitation|\belicit(ation|Input)?\s*\(|ElicitRequest|elicitation/create'
  'crewai|human_input\s*=|HumanInputTask|ask_human'
  'autogen|UserProxyAgent|human_input_mode'
  'humanlayer|humanlayer|human_as_tool'
  'gotohuman|gotohuman|goto_human'
  'hitl-vendor|hitl\.sh|pushary|humanauth|permissionprotocol'
  'n8n|sendAndWait|Send and Wait|waitForWebhook|"type":\s*"n8n-nodes-base\.wait"'
  'slack-interactive|interactive_message|block_actions|[Xx]-[Ss]lack-[Ss]ignature|signing_secret|signingSecret'
  'teams-adaptive|adaptiveCard|AdaptiveCard'
  'email-code|approval code|verification code|\bOTP\b|one[- ]time code|emailApprovalCode|handleEmailCode'
  'approval-state|awaiting_approval|pending_approval|pendingAction|pending_action|approval_required|requires_human|human_review|review_required|needs_human|AWAITING_APPROVAL|PENDING_APPROVAL'
  'approval-handler|handleApproval|approvalCallback|onApprove|approveRequest|approve_request|ApprovalDecision|receive[A-Za-z]*Interaction|handle[A-Za-z]*Interaction|decision\s*[:=]\s*["'"'"'](approve|deny)'
  'approval-route|/approv(e|al|als)\b|/callback\b|/decision\b|/review\b'
  # property-1 signal: anything that rewrites a pending action after it was requested
  'amend-pending|amendPending|amend_pending|updatePending|update_pending|patchPending|patch_pending|pendingAction\.args\s*=|pending_action\[|setPendingAction|editPending'
  # property-5 signals: can the agent read the approval channel, decide when it is supervised, or write the record?
  'agent-reads-channel|readInbox|read_inbox|listMessages|list_messages|conversations\.history|gmail|imap|readSlack|read_slack|fetchMail|get_messages|readEmail|read_email'
  # where the when-to-ask policy lives: check which module AND which process holds it before scoring row 5
  'when-to-ask-policy|THRESHOLD|threshold\s*[:=]|needsApproval\s*=|needs_approval\s*=|requiresApproval\s*=|> *[0-9_]{3,}\s*(;|\)|$)'
  # fail-open secrets: env var falling back to a compiled-in constant
  'secret-fallback|process\.env\.[A-Z_]*(SECRET|KEY|TOKEN)[A-Z_]*\s*(\?\?|\|\|)\s*("[^"]+"|'"'"'[^'"'"']+'"'"'|`[^`]+`|[A-Za-z_][A-Za-z0-9_.]*)'
  'audit-writer|appendFileSync|audit\.log|audit\s*\(|auditLog|audit_log|writeAudit'
)

if [ "$mode" = "--all" ]; then
  patterns+=(
    'execution-point|\btransfer(Funds|Money)?\s*\(|\bpayout\s*\(|\.delete(Many|One)?\s*\(|rm -rf|DROP TABLE|\bsendEmail\s*\(|\bsend_mail\s*\(|\bdeploy\s*\('
  )
fi

excludes=(node_modules .git dist build .next coverage vendor __pycache__ .venv venv target)
if [ "$mode" != "--all" ]; then
  excludes+=(test tests __tests__ spec docs doc fixtures examples)
fi

have_rg=0
if command -v rg >/dev/null 2>&1; then have_rg=1; fi

run_search() {
  local regex="$1"
  if [ "$have_rg" -eq 1 ]; then
    local args=(--line-number --no-heading --color=never --max-columns 160 --hidden)
    for e in "${excludes[@]}"; do args+=(--glob "!**/$e/**"); done
    if [ "$mode" != "--all" ]; then
      args+=(--glob '!*.md' --glob '!*.json' --glob '!*.lock' --glob '!*.txt' --glob '!*.test.*' --glob '!*.spec.*' --glob '!*_test.*')
    fi
    (cd "$root" && rg "${args[@]}" -e "$regex" . 2>/dev/null | sed 's#^\./##') || true
  else
    local args=(-rnE --line-number)
    for e in "${excludes[@]}"; do args+=(--exclude-dir="$e"); done
    if [ "$mode" != "--all" ]; then
      args+=(--exclude='*.md' --exclude='*.json' --exclude='*.lock' --exclude='*.txt' --exclude='*.test.*' --exclude='*.spec.*' --exclude='*_test.*')
    fi
    (cd "$root" && grep "${args[@]}" -e "$regex" . 2>/dev/null | sed 's#^\./##' | cut -c1-200) || true
  fi
}

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

for entry in "${patterns[@]}"; do
  label="${entry%%|*}"
  regex="${entry#*|}"
  run_search "$regex" | sed "s/^/$label\t/" >> "$tmp"
done

sort -u "$tmp" -o "$tmp"

echo "== gate candidates by label =="
cut -f1 "$tmp" | sort | uniq -c | sort -rn | awk '{printf "  %-22s %s\n", $2, $1}'
echo
echo "== hits =="
cat "$tmp"

cat >&2 <<'EOF'

For each gate, find its four points: request (rendered to a human), decision
(where the yes arrives), execution (where the action runs), record (what
persists). Then score the six properties in SKILL.md. Re-run with --all to
include tests, docs and broad execution-point patterns.
EOF
