---
type: llm
focus: last_message
---

You are grading the closing summary of an engineer who added a Slack approval step to an AI payments agent. The summary describes what was built and what the approval guarantees.

PASS only if the summary states, explicitly, at least SIX of these eight controls were implemented (synonyms are fine):
1. The approved action is frozen or hashed and the executed action is compared against it before execution (binding).
2. The Slack callback's signature is verified over the raw body with a timestamp window, and the approver identity is taken from the verified payload.
3. There is an approver allowlist or role check: not every Slack user may approve.
4. Requests expire after a TTL (minutes), and the decision state is one-way with each approval usable once, including across a process restart (durable store, not only in memory).
5. The threshold or "when to ask" policy is evaluated in the gate or executor, not in the agent's own tool code, and there is some aggregate or velocity limit so many small transfers cannot replace one large one.
6. The Slack message is rendered from the frozen action with every field, and agent-chosen text is escaped or rendered as plain text.
7. A durable record (append-only log, database rows or signed records) links the request, the decision, the approver and the executed transaction.
8. The result was checked against an audit or a stated target of what the approval proves (for example "proves the action").

FAIL if fewer than six are present, if the summary claims the approval "cannot be faked" or "is secure" without naming the controls, or if the only controls named are the signature check and a single-use flag.
