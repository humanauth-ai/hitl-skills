#!/usr/bin/env bash
# Seed the workspace with the vulnerable payments agent, minus the probe file
# the skill produced on it, so the agent under test has to derive the probes.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/../../fixtures/vulnerable-payments-agent"
cp -R "$src"/. .
rm -f test/approval-integrity-probes.test.ts
# The fixture README names the skill and the verdict; the agent must not see them.
cat > README.md <<'EOF'
# payments-agent

Internal payments agent. Transfers over the threshold are posted to Slack for
approval; email code fallback when Slack is unavailable.

    npm test
EOF
git init -q
git -c user.email=eval@example.com -c user.name=eval add -A
git -c user.email=eval@example.com -c user.name=eval commit -qm "payments agent" >/dev/null
