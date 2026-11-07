---
type: llm
focus: last_message
---

You are grading a security write-up about a human-approval flow in an AI payments agent.

PASS only if ALL of the following are true:
1. The write-up states, in one line, what the approval proves, using one of the phrases "proves nothing", "proves a click" or "proves the action" (any formatting).
2. It covers each of these six concerns, by these names or close synonyms: binding of the approved action to the executed action; what the human was shown (rendering); authentication of the decision channel; freshness or single use (replay, deny-then-approve, re-execution); whether the agent itself can produce or obtain the approval and who sets the approval threshold (approver anchoring); what evidence record exists afterwards.
3. It reports at least one test that was actually written and run against the code, with the runner's output or a clear statement of pass/fail counts, as opposed to only describing what an attacker "could" do.
4. It identifies that the agent can read its own email approval code or that the approval threshold lives in the agent's own code (either one suffices).
5. It ends with, or contains, a short plain-language paragraph a non-engineer compliance reviewer could paste into a response, stating what the approval currently proves and does not prove.

FAIL if any of the above is missing, if findings are ranked only by severity labels such as Critical/High/Medium with no statement of what the approval proves, or if the write-up recommends a vendor product before framework-native fixes such as hashing the action, authenticating the callback, and moving the threshold out of the agent.
