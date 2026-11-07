<!-- Verbatim report produced by the human-approval-audit skill on 2026-11-07,
run blind against HumanAuth's own deploy example (in the private monorepo) at
the commit before fbe9cf2. Only absolute paths were removed. The "after"
section at the end was added by hand. -->

> **Why this file exists.** The skill in this repo was run on its author's own
> example before the author fixed anything. The verdict was *proves a click*.
> This is the report, unedited, followed by what changed. Blog post:
> https://humanauth.ai/blog/we-audited-our-own-approval-gate

# Self-audit: HumanAuth's `examples/deploy-approval-gate`, before the fixes

## 1. Verdict

**Deploy approval gate** (`examples/deploy-approval-gate/src/backend.ts:37-48`, decision verified in `packages/verifier/src/verifier.ts:112-287`): **proves a click.**

Rule applied: property 3 passes; properties 1, 4 and 6 fail; property 5 is Unknown (its decisive half cannot be probed without the live platform). "A click" here is stronger than usual: it is a biometric-gated device signature by an enrolled human over a hash. But the hash does not cover the deploy that runs, single-use does not survive a restart, and the operator keeps nothing afterwards.

## 2. What the approval record establishes

The record is the receipt JWS (platform-signed EdDSA envelope, `receipts/issue.ts:172-184` in the platform). The backend verifies it and then discards it; the only thing retained is one stdout line (`backend.ts:53`).

| Field | Proves | Does not prove |
|---|---|---|
| Platform signature (`iss`, `aud`, `kid`) | api.humanauth.ai issued this receipt for tenant `aud`, within the last ≤10 min (`verifier.ts:142`) | Anything about the human, by itself |
| `ha.result: "approved"` | The **platform** says the decision was approve | The device said approve. The device signature covers no decision bit (`cosig.ts:17-23`); a denial re-labelled by the platform key verifies (probe) |
| `ha.plan_hash` | A human's device signed SHA-256 of `{action, intent, severity, description:"Deploy web to us-east-1"}` | Which image, commit, replicas, or any body field other than the two interpolated into that sentence (probes) |
| `ha.approvers[].huid/device_id/device_pubkey/device_sig` | The holder of this key decided on this plan hash for this request_id at `decided_at` | That the key belongs to that huid: the key-to-human binding is platform-attested, not independently verifiable |
| `ha.approvers[].assurance` | Platform-relayed label; verifier enforces it against tenant `required_assurance` when present (`verifier.ts:233-242`) | That the device actually performed a biometric (label is supplied by the app, not signed by the OS) |
| `sub` | Platform-asserted human id; this is what the backend logs as "approved by" (`backend.ts:52`) | Device-signed identity; `sub` can differ from the cosigned `approvers[].huid` (probe) |
| `jti`, `exp` | Single-use within one process lifetime; valid ≤600 s | Single-use across restarts (probe); verifiability after expiry (probe) |
| Operator record (stdout) | A deploy of `service → region` happened and someone was named | Which receipt, which request, which plan hash; not retained, not tamper-evident, not linkable |

## 3. Scorecard

| # | Property | Verdict | Status | Where | Probe |
|---|---|---|---|---|---|
| 1 | Binding | **Fail** | confirmed | `backend.ts:42-47` (template), `verifier.ts:210-215` (compare) | `PROBE binding:` ×3 |
| 2 | Rendering | **Fail** | asserted | `agent.ts:25` (agent composes description); `packages/app/src/crypto/respond-cosig.ts:59-63` (device signs server-supplied hash); `packages/app/app/approval/[requestId].tsx:667` renders plan fields | reading probe; coercion/ambiguity probes show the rendered sentence under-determines the action |
| 3 | Channel authenticity | **Pass** | confirmed | `jws.ts:29-36`, `cosig.ts:43-55`, `verifier.ts:177-184` | `CONTROL` rogue key, denied, missing; caveats: `PROBE channel:` ×2 |
| 4 | Freshness and single use | **Fail** | confirmed | `backend.ts:28` (MemoryReplayStore), `verifier.ts:258-274`, `stores/memory.ts:14-27` | `PROBE single-use: ... restarts` |
| 5 | Approver anchoring | **Unknown** | confirmed (relying-party half) / asserted (platform half) | `agent.ts:9,23` (agent picks approver); `backend.ts:52` (no approver policy); `packages/sdk/src/client.ts:179-181` (agent key can invite humans); `verifier.ts:166-172` (required_principals only if tenant policy embeds it) | `PROBE anchoring:` ; self-enrolment path not runnable offline |
| 6 | Evidence | **Fail** | confirmed | `backend.ts:53` (console.log only); `jws.ts:29` (exp always enforced, no audit mode) | `PROBE evidence:` ×2 |

What **passes** and is worth saying plainly: the hash comparison itself works (swapped region → 403), unsigned or rogue-key receipts are refused, denied receipts are inert at the verifier, in-process replay is refused in all three idempotency-key cases, when-to-ask is enforced at the executor (no receipt → 401), and the platform's hashed plan for this request canonicalizes to exactly what `planFromReq` reproduces (`authorize.ts:460-466` vs `backend.ts:42-47`, confirmed by the first control).

## 4. Probes and results

File: `deploy-gate.probe.test.mjs` (written outside the example, which had no test runner at the time) (the example directory was read-only, so the probes live in the scratchpad; see Skill feedback). The suite spawns the example's real `dist/backend.js`, serves a local JWKS as the platform, and mints receipts with `@humanauth/verifier/fixtures`.

Command: `node --test deploy-gate.probe.test.mjs`

```
✔ CONTROL binding contract: platform's hashed plan == backend planFromReq for this request
✔ CONTROL no receipt -> 401 MISSING_RECEIPT (when-to-ask is enforced at the executor)
✔ CONTROL swapped region -> 403 PLAN_HASH_MISMATCH
✔ CONTROL denied receipt -> 403 NOT_APPROVED
✔ CONTROL receipt signed by a key not in the platform JWKS -> 403
✔ CONTROL in-process replay: same receipt again -> 409 (same key, no key, different key)
✔ PROBE binding: fields the plan template does not mention are unbound (image, replicas)
✔ PROBE binding: template coercion — arrays for service/region pass the hash check
✔ PROBE binding: delimiter ambiguity — one receipt authorizes two different (service, region) pairs
✔ PROBE channel: a DENIAL re-labelled 'approved' by the platform key verifies — device cosig unchanged
✔ PROBE channel: the approver the backend records (`sub`) is platform-asserted, not device-signed
✔ PROBE single-use: a used receipt is accepted again after the backend restarts (MemoryReplayStore)
✔ PROBE anchoring: a receipt approved by any enrolled identity is accepted — no approver constraint
✔ PROBE evidence: the only operator-side record is a stdout line without jti, request_id or plan_hash
✔ PROBE evidence: an archived receipt cannot be re-verified after it expires (no audit mode)
ℹ tests 15  ℹ pass 15  ℹ fail 0
```

A passing PROBE is the gap. One control's assertion originally named error code `JWKS`; the actual refusal is 403 `JWS_SIGNATURE` because `jws.ts:46` rewraps every jose error before `verifier.ts:124-129` can classify it (that branch is unreachable on the remote-JWKS path). Cosmetic; the refusal holds.

## 5. What a misbehaving agent or an attacker can do

1. **(Row 1, confirmed)** Request approval for "Deploy web to us-east-1"; human approves; POST `{service:"web", region:"us-east-1", image:"attacker/backdoor:latest", replicas:500}` with the receipt. Accepted. The receipt binds the sentence, not the deploy; every field a real deploy consumes beyond the two interpolated words is unbound.
2. **(Row 1, confirmed)** Same approval; POST `{service:["web"], region:["us-east-1"]}`. Accepted, because `${["web"]}` is `"web"`. The executor receives arrays where it expects strings.
3. **(Row 1, confirmed)** Request "Deploy api to prod to us-east-1" (service `api to prod`); human approves; POST `{service:"api", region:"prod to us-east-1"}`. Accepted. One receipt authorizes two different (service, region) pairs because the template delimiter ` to ` can appear in a value.
4. **(Row 3 caveat, confirmed)** Anyone holding the platform signing key, or a compromised platform, takes a receipt the human **denied**, changes `ha.result` to `approved`, re-signs the envelope with a fresh `jti`, and the backend deploys. The device co-signature is byte-identical for approve and deny (`cosig.ts:17-23`), so the "approved" bit rests on one party. Denials are therefore a supply of forgery material under platform compromise.
5. **(Row 3 caveat, confirmed)** A receipt whose `sub` is `hu_alice` but whose device-signed approver is `hu_mallory` is accepted and logged as "approved by hu_alice" (`backend.ts:52`). The identity the operator records is not the one the device signed.
6. **(Row 4, confirmed)** Agent deploys with a valid receipt; backend restarts (deploy, crash, scale event); agent (or anyone who captured the receipt in transit or logs) presents it again within its ≤10-minute window. Deployed twice on one approval. `MemoryReplayStore` refuses to start only under `NODE_ENV=production` (`stores/memory.ts:20`); the example never sets it.
7. **(Row 5, confirmed)** The backend accepts a receipt approved by **any** identity for which a device-cosigned receipt exists; it has no notion of who is allowed to approve a production deploy. The agent chooses the approver (`agent.ts:9,23`).
8. **(Row 5, asserted)** The agent's tenant API key can invite humans (`client.ts:179-181`). If the agent can also receive email at an address it invites (an inbox tool, a shared mailbox), it can enrol a device and approve its own deploys. Closing this loop requires the live platform's email verification and was not run, per the skill's rule.
9. **(Row 6, confirmed)** After a deploy, the operator holds one stdout line naming a human and two words. No jti, request id, plan hash, or receipt is kept; the receipt itself is third-party-verifiable material and it is thrown away. Even if it were kept, a verifier cannot re-verify it after expiry, so an auditor arriving a month later gets `RECEIPT_EXPIRED`, not a proof.

## 6. Remediation ladder

1. **Binding (fixes rows 1 and 2).** Hash a structured plan that contains every field the deploy consumes (service, region, image digest, replicas, commit), not a sentence. The platform already accepts `body.plan` (`authorize.ts:460`), but `AuthorizeOptions` in the SDK has no `plan` field (`packages/sdk/src/types.ts:25-35`), so the SDK needs a passthrough; until then, make `description` an unambiguous canonical encoding of the parameters, and have `planFromReq` validate types and reject unknown body fields before hashing.
2. **Channel (hardens row 3, supports row 6).** In the handler, record the approver from the device-signed `req.humanAuth.approvers[].huid` rather than `subject` (`backend.ts:52`). Vendor-side: add `result` and role to the co-signed message with domain separation so a device signature over a denial cannot be re-labelled; this is a wire-format change across platform, both apps and verifier.
3. **State machine (fixes row 4).** Replace `MemoryReplayStore` with the Redis, Postgres or SQLite store (`backend.ts:28`) and set `NODE_ENV=production` so the guard at `stores/memory.ts:20` can never be bypassed silently. Keep `idempotency-key = jti` as the agent already does (`agent.ts:45`).
4. **Anchoring and policy placement (resolves row 5).** Configure the tenant approval policy so `ha.approval.required_principals` is embedded and the verifier enforces it (`verifier.ts:166-172`), or allowlist `approvers[].huid` in the handler. Take approver selection out of the agent (`agent.ts:9`): route by action on the platform side. Scope the agent's API key so it cannot invite humans or create groups.
5. **Evidence (fixes row 6).** The approval already must be evidence to a security reviewer, so this rung is retention, not adoption: per deploy, persist the receipt JWS, the exact plan object `planFromReq` returned (the hash's preimage, without which the receipt proves "something with hash H"), jti, request id, approvers, and the comparison outcome, in an append-only store the agent cannot write to. Vendor-side: an audit-mode verification that checks signatures, co-signatures and plan hash while skipping `exp` and replay, plus archived JWKS keys, so receipts stay verifiable after ten minutes.

## 7. Statement for the auditor

Today the approval record shows that an enrolled person's device signed, with a biometric-gated key, a hash of the sentence "Deploy web to us-east-1", and that the approval service countersigned that record as approved for our tenant. It does not establish which artifact or configuration was deployed, because only that sentence, not the deploy request, is covered by the hash; it does not establish that the "approved" decision was the person's rather than the service's, because the device signature is identical for approve and deny; it does not guarantee a single execution across a restart of the deploy service; and we retain no copy of the record, so we cannot produce it or re-verify it later. Remediation items 1 to 4 close those gaps; item 5 would let a party outside our systems check the record months after the fact.

---

## After the fixes (commit `fbe9cf2`, 2026-11-07)

Every PROBE above that was reachable from the relying party became a test with
the assertion flipped to "refused". The suite is `test/gate.test.ts` in the
example (19 tests, vitest, receipts minted locally against a local JWKS).

| Row | Attack | Before | After |
|---|---|---|---|
| 1 | Approve one image digest, deploy another (or other replicas, commit, region, service) | deployed | `403 PLAN_HASH_MISMATCH` |
| 1 | Receipt for the sentence-shaped plan "Deploy web to us-east-1" | deployed | `403 PLAN_HASH_MISMATCH` |
| 2 | `service: ["web"]`, `replicas: "3"`, an unknown field, a mutable `:latest` tag | deployed | `400 INVALID_DEPLOY_PARAMS`, before anything is hashed |
| 3 | No receipt; a denied receipt | refused | refused (unchanged, controls) |
| 4 | Use a receipt, restart the service, use it again | deployed twice | `409 REPLAY` (sqlite on disk) |
| 5 | Valid receipt signed by a device the service does not list | deployed | `403 APPROVER_NOT_ALLOWED` |
| 5 | Platform-asserted `sub` names the allowed approver, device signature names someone else | deployed, logged as the wrong person | `403`; policy and log read the device-signed list |
| 5 | Start the service with no approver policy | started | refuses to start |
| 6 | Operator record | one stdout line | audit entry with params, device-signed approvers, asserted subject, receipt id, request id |

What the fixes changed outside the example: `@humanauth/sdk` gained a `plan`
passthrough on `authorize()` (the platform already hashed `body.plan`;
the SDK had no way to send it), and `@humanauth/verifier` gained a
zero-dependency `NodeSqliteReplayStore` on `node:sqlite`.

What is still open, and why the honest verdict is still *proves a click* on
the strict rule: the device co-signature does not cover approve versus deny
(rows 3 caveat, item 4 above), and the verifier has no audit mode, so an
archived receipt cannot be re-verified after it expires (row 6, item 9).
Both are protocol changes, tracked on the HumanAuth backlog; this file will
be updated when they ship and the audit is re-run.
