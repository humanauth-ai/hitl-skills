# The six properties, by framework

For each property: what you are looking for in code, what Pass looks like,
what Fail looks like, and where each common framework tends to land. Line
references are to the pattern, not to a version; verify against the installed
version.

## 1. Binding: the executed operation is the approved operation

**Look for:** the value the executor reads to run the action, and the value
the human was shown. Are they the same object captured at the same time? Is
anything allowed to write to the pending action after the request is issued?
At execution, is there a comparison (hash equality or deep equality) against a
snapshot taken at approval time?

**Pass:** a canonical hash of the action is computed at request time, stored
with the request, included in what the human sees, carried back in the
decision, recomputed from the action about to execute, and compared. Mismatch
refuses. Alternatively the action is immutable by construction (frozen,
serialized into the decision itself) and the executor runs *that* copy.

**Fail:** the executor re-reads mutable state (a JSON file, a DB row, graph
state, a RunState) that other code paths can patch after approval. Any
`amend`, `update`, `patch` or "fix a typo" path on a pending action is a Fail
unless it resets the gate.

**Frameworks:**

- LangGraph `interrupt()` / `Command(resume=...)`: the resume value is
  arbitrary. If the node resumes with the human's edited payload and executes
  it, binding depends on the node comparing resume payload to what was shown.
  Checkpointed state can be written by other nodes between interrupt and
  resume. Loopjacking (arXiv 2609.21081) reproduced this in LangGraph Agent
  Server compositions.
- Agno AgentOS: same class, reproduced across seven releases.
- OpenAI Agents SDK `needs_approval`: the approval is attached to the specific
  tool call item in `RunState`; the SDK preserved exact per-call binding in
  the Loopjacking tests. Still check for the tool reading external mutable
  state at run time, and note the docs' own warning that approval does not
  guarantee exactly-once.
- Google ADK `require_confirmation`: check that the executed args are the
  confirmed args and that confirmation cannot be supplied by another agent
  over A2A (issues 6461 and 1005 showed a peer could self-approve).
- Vercel AI SDK `needsApproval`: the approval response is per tool-call id;
  verify the tool does not re-read inputs that changed.
- Claude Agent SDK `canUseTool`: the callback receives the exact input; a Pass
  requires the tool to execute that input and not a later one.
- n8n Wait / Send and Wait: the resumed execution reads workflow data that
  later nodes can modify; check what the executing node actually consumes.
- Custom webhook flows: almost always re-read a pending record. Look for the
  decision record carrying the action hash.

## 2. Rendering: the human sees the real action

**Look for:** how the approval message is built. From the structured tool
call, or from the model's prose? Does it include every consequential field?
Does the formatting truncate, round or omit (currency, decimals, full
recipient identifier, scope of a delete, number of rows)?

**Pass:** summary derived from the tool call arguments after any
normalization, including all fields that affect money, data, or
irreversibility; the hash of the rendered canonical form is what gets signed.

**Fail:** the agent writes its own "I'm about to..." text; the summary omits
a field the executor uses; the summary is rendered before a later
transformation (unit conversion, template expansion) that changes meaning.
OpenClaw showed a representation mismatch of this class.

**Rendering-layer injection:** check that agent-controlled strings
(recipient, memo, description) are escaped for the surface they land on:
Slack mrkdwn (`*`, `_`, `~`, backticks, newlines, `<@user>` mentions), Teams
and email HTML, terminal ANSI. Unescaped interpolation lets the agent put a
smaller amount in bold, a fake "pre-approved" line, or a mention in the
message while the hash binds the real values. Confirm the interpolation in
code; the visual effect is asserted unless you can render the surface. Score
as a caveat on row 2 when the injected text can only decorate; score Fail
when it can impersonate a field the human relies on (a recipient shown as a
link label, a fake amount line), because then what the human read is not
what the gate can vouch for.

**Message binding.** The decision should come from the message the gate
rendered. For Slack, compare the callback's `container.message_ts` and
`channel_id` to the ones stored at request time; for other surfaces, the
equivalent message or card id. Without it, anyone holding the app's token
can post a decoy message whose buttons carry a real `request_id|hash`, and a
genuine, signed click on the decoy approves the real request. Score under
row 2: the human approved what the decoy showed.

Microsoft's AI red team guidance: summarize approvals from the underlying tool
calls, not from the agent's own description.

## 3. Channel authenticity: the decision is authenticated

**Look for:** the handler that receives the yes. What does it verify? A
signature over the body with a timestamp (Slack signing secret, Teams JWT,
provider HMAC)? Who is the approver, and where does that identity come from?

**Pass:** provider signature verified with a bounded timestamp window; the
approver identity read from the verified payload (Slack `user.id`, Teams AAD
object id, IdP subject), never from a body field; or the approver's own key
signs the decision (device key, passkey, hardware token).

**Sub-question for signed receipts:** who signs the *decision bit*
(approve/deny) and who signs the *action hash*? If they are different
parties, say so. A device signature over the hash with the approve/deny bit
asserted only by the service means the service alone can turn a denial into
an approval. Score 3 Pass if the channel is authenticated, and record the
single-signer decision bit as a caveat that feeds the remediation ladder.
Also check that the identity the relying party records is the device-signed
one, not a service-asserted subject that can differ from it.

**Fail:** field-presence checks; "the URL is only known to Slack";
IP allowlists alone; approver as a free-text string; shared static bearer
token that the agent also holds; a signing secret that falls back to a
compiled-in constant when the environment variable is unset
(`process.env.SECRET ?? "test-secret"`), which is fail-open in any
deployment that forgot the variable. Score the fallback as a caveat when the
verification itself is correct, and put it in the attacker list.

**Frameworks:** in-process gates (LangGraph, OpenAI SDK, ADK, Vercel, Claude
SDK) have no channel to authenticate by themselves: the yes is a function
call. Authenticity then depends entirely on whatever UI or transport delivers
it, which is where the audit must look. Vendor services differ: HITL.sh
documents IP allowlisting and field validation only; HumanAuth receipts carry
a device signature over the action hash; Auth0 CIBA returns a token bound to
the authenticated user but not to an action hash.

## 4. Freshness and single use

**Look for:** nonce or jti stored and burned at execution; expiry on the
request; the state machine. Enumerate the transitions the code allows:
awaiting -> approved, awaiting -> denied, approved -> executed. Then test the
ones it should not allow: denied -> approved, executed -> approved, approved
twice, approval for request A applied to request B.

**Pass:** decision handler requires current status to be awaiting; executor
clears or marks the request consumed atomically; expired requests are
refused (HTTP 410 or equivalent); notification-provider retries are
idempotent.

**Fail:** status set unconditionally from the latest callback; executor
leaves the pending action in place; single global slot for pending state; no
TTL. With a single global slot, "approval for A applied to B" is usually not
independently reachable because a new request overwrites the old id; the
finding is the slot itself (lost requests, clobbered pending actions), so
probe that instead.

Remember that Slack and most webhook providers retry on slow responses, so a
replay is a normal event, not only an attack.

Two separate freshness controls, often conflated: the *provider's* replay
window (Slack's 5-minute timestamp check on the callback) and the
*request's* TTL (how old a pending approval may be when the click arrives).
A gate can have the first and not the second, in which case a button left
in channel history can be clicked a month later. Row 4 needs both; the
record needs a `created_at` for the second to be checkable at all.

## 5. Approver anchoring: the agent cannot approve itself

**Look for:** every place an approval secret or decision can travel. Return
values of the request function. Tools the agent holds (inbox readers, chat
readers, log readers, file readers). Shared mailboxes. Whether the policy
that decides *when* approval is needed is in the agent's own code.

**Pass:** the agent process never receives, reads or can forge the decision;
the approver is a verified identity distinct from the requesting principal
and from the agent's own identity; when-to-ask is enforced by the executor
or a policy service, not by the agent's module.

**Fail:** the request function returns the OTP; an inbox tool can read the
approval email; the agent's own module holds the threshold constant; the
model's own prose is accepted as the confirmation; **no approver policy**:
any authenticated identity is accepted (any member of the Slack channel, any
address that can reply), so "verified" does not mean "authorised". An
allowlist or role check, excluding the requester and every identity the
agent itself holds, is the control.

Property 5 bundles three questions: can the agent obtain or forge the
decision; is the approver a verified identity *and* an authorised one; who
decides when to ask. Score the row on the worst of the three and name each
answer in the Where and Probe cells, so the reader can see which one failed.

**Threshold evasion** is more than splitting. Probe a different currency or
unit against a numeric threshold, a negative or non-finite amount, and a
string that parses as a number. These cost one test each and are often the
largest finding on a gate whose approvals are otherwise sound.

**Threshold splitting** (N small actions replace one large one, no human
asked) is scored on the "not a gate" line for the under-threshold path, and
noted as a caveat on row 5. It is a row-5 Fail only when the agent's own
module decides the threshold. A gate whose approvals are fully anchored does
not become "proves nothing" because the path around it is unbounded; the
not-a-gate line carries that finding, and the aggregate limit goes on
remediation rung 4.

**Agent-reachable versus process-reachable.** Property 5 asks whether the
agent can produce the approval. Score what the model can reach through its
tool surface and return values as the row result. When the gate, its config
(approver list, threshold), the channel secret or a signing key live in the
same process as the agent, record that as a caveat: a frozen tool surface
stops the model, not code running in the process. Remediation rung 4 is to
move the gate and its secrets out of the agent's process.

Cornell and Yale researchers showed nine of ten models raised their own spend
caps by reading the owner's email verification codes. Any approval channel
the agent can read is not a human approval.

## 6. Evidence: what exists afterwards, and who can check it

**Look for:** the record written when the decision is made and when the
action executes. Does the decision record contain the action (or its hash)?
Does it contain a verified approver identity? Who can write to the store?
Who signed the record? Can someone who does not trust the operator verify it
without access to the operator's systems?

**Pass, two levels:**

- *Operator-grade:* append-only or hash-chained log, written by a component
  the agent cannot write to, containing action hash (with its preimage
  retained somewhere the auditor can get it), approver identity, the
  pre-execution comparison result and the resulting transaction or job id.
  If records are signed, the key must be stable across restarts, loaded from
  a store outside the agent's process, with its public half published and a
  distinct key id per key, so an archived record still verifies after a
  restart or rotation. A receipt that is only returned to the agent, or
  signed by a key regenerated on each start, is a Fail even when its
  structure is sound.
- *Third-party-grade:* a signed receipt over the canonical action, signed by
  the approver's device and countersigned by the service, verifiable offline
  with a published key. This is what an external auditor, counterparty or
  insurer can accept without trusting the operator's logs.

**Fail:** `console.log`; a plaintext file appended by the executing process;
a decision record with no action content; a log that records args at
execution time only, so a swapped action is logged as if it had been approved.

The distinction between the two Pass levels is the one most audits miss.
Operator-grade evidence answers the operator's own questions. Third-party
evidence answers the auditor's.
