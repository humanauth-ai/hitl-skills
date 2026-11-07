# Where each piece goes, by framework

The procedure in SKILL.md has nine steps. The framework gives you the
request point and sometimes the resume point; everything else is yours. For
each framework: what it provides, what you add, and the trap.

## Plain code, Slack buttons

- **Request:** the gate posts a Block Kit message built from the frozen copy:
  one `fields` entry per field, request id, hash prefix; Approve and Deny
  buttons whose `value` is `request_id|hash`. Escape mrkdwn in every value.
- **Decision:** an HTTP handler receives the interaction. Verify
  `X-Slack-Signature` as `v0=HMAC_SHA256(secret, "v0:" + ts + ":" + rawBody)`
  with constant-time compare and a 5-minute window on `ts`; parse only after
  verification; Slack sends `payload=<urlencoded JSON>`, so verify the exact
  raw bytes your adapter received. Approver is `payload.user.id`. Check the
  allowlist. Compare the button's hash to the stored hash. Acknowledge within
  3 seconds; execute after acknowledging if the bank is slow.
- **Trap:** the receiver and the agent in one process means the agent's
  process holds the signing secret. Split them, or accept the caveat in
  writing.

## Microsoft Teams, Adaptive Cards

Same shape. Verify the Bot Framework JWT on the incoming activity; approver
is the AAD object id from the verified token, not a card field. Use
`Action.Execute` with the request id and hash in `data`.

## Email

Do not send a code the agent might be able to read; nine of ten models in
the Cornell/Yale study read their owner's verification codes. Send a link to
an authenticated page where the human sees the frozen copy and decides, or
use a device app. If a code is unavoidable, the inbox must be one the agent
has no tool for, and the code must be compared against a server-held value,
never a caller-supplied one.

## LangGraph `interrupt()` / `Command(resume=...)`

- **Request:** in the gating node, build the frozen copy and hash, put both
  in the `interrupt(payload)` so the checkpoint carries exactly what was
  shown. Use a durable checkpointer.
- **Decision:** `Command(resume=...)` is a function call with an arbitrary
  value. Never let a client resume with an edited action. Your authenticated
  decision handler (Slack, Teams, your UI) maps a verified decision to
  `Command(resume={decision, request_id, hash})`; the node after the
  interrupt recomputes the hash from the frozen copy in the interrupt
  payload, compares to the resume value, and executes the frozen copy, not
  the current graph state. Other nodes can write state between interrupt
  and resume; that is the Loopjacking class.
- **Trap:** LangChain's `HumanInTheLoopMiddleware` and the Agent Server
  resume endpoint accept whatever the caller posts. The gate is the thing
  in front of that endpoint.

## OpenAI Agents SDK `needs_approval`

- **Request:** `needs_approval: true` or a function on the tool. The run
  returns `interruptions`; serialise `RunState` server-side (not to the
  client), render the frozen copy of `item.arguments` to the human.
- **Decision:** `state.approve(item)` or `reject(item)` only from your
  authenticated handler, after comparing `item.arguments` to the frozen
  copy you rendered. Resume with the server-held state.
- **Trap:** the docs say approval does not guarantee exactly-once. Add your
  own request record with single-use and a TTL; `RunState` is not that.

## Google ADK `require_confirmation`

- **Request:** the tool returns a confirmation request; render from the
  tool's actual args.
- **Decision:** accept the confirmation only from the user channel, never
  from a peer agent over A2A (issues 6461 and 1005 showed a peer could
  self-approve). Compare the confirmed args to the executed args.

## Vercel AI SDK `needsApproval`

- **Request:** the tool call pauses with a tool-call id; render the frozen
  input server-side.
- **Decision:** `addToolApprovalResponse` arrives from the client session.
  Treat the client as unauthenticated for this purpose: your server checks
  the session's identity against the approver policy and that the tool input
  is byte-identical to what was rendered before letting the tool run.

## Claude Agent SDK `canUseTool` / permission hooks

- **Request:** the callback receives the exact tool input. Build the gate
  inside the callback: freeze, hash, request, wait.
- **Decision:** return allow only when your authenticated handler has
  recorded an approval for that hash. Return deny on timeout. The callback
  itself is in the agent process; the record and the decision channel are
  outside it.

## MCP elicitation

Elicitation goes to the MCP client, which asks the human. Put the frozen
copy and hash in the elicitation message. Treat the result as an approval of
*that* hash only; a server that elicits once and executes something else is
the same bug as a Slack button whose action was amended. The client is the
channel; if it is the agent host itself, property 5 depends on whether the
model can answer its own elicitation.

## n8n Wait / Send and Wait

- **Request:** the Send and Wait node posts the message and suspends the
  execution. Put the frozen copy in the message, built from the node's
  input, not from a later expression.
- **Decision:** the resume webhook must be signed (use the node's signed
  URL option or a verifying node in front of it) and must carry the request
  id and hash. The executing node consumes the Wait node's output snapshot,
  not data a later node could have rewritten.

## Vendor HITL services

If a service (HITL.sh, gotoHuman, HumanAuth, an IdP's CIBA flow) delivers
the yes, your side still owns binding, the state machine, the policy and
the record. Verify the service's signature and the action hash in your
receiver; a parsed callback is not a verified one. If the service issues
signed receipts, retain the receipt, the hash preimage and the comparison
outcome where the agent cannot write, and confirm an archived receipt can
still be verified after it expires.
