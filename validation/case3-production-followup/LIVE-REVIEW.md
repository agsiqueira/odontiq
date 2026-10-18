# Case 3 commit review and local production-build live verification

## Decision: draft review only; do not promote this candidate

Reviewed/tested application: `3a7b37b1d33a12db20be90ee7b24261faa4558be`, based on deployed merge `69a24fe9fb6d1121e67da8d2ce70cc02b574266c`. No application source changed during this review. New changes are permanent live-test infrastructure, a package script, and evidence. Production was not modified, redeployed, merged or rolled back.

The original omission is repaired in five independent fresh local encounters. However, broader live review found **one same-turn clinical-paraphrase defect in the new guard** and **three already-answered conversation findings under the existing current-turn contract**. The PR must remain a draft until these are resolved or the authority decision is explicitly made. Do not interpret the passing deterministic checks as release approval.

## Configuration and execution

- Node `v24.14.1`, Next `16.2.10`, `NODE_ENV=production`; `next start --port 3009`, application build ID `zSWm2Jqeeb7eHh-8jJUvQ`. This is the successful production build recorded in `checks-final.json`, not a development server or alternate route implementation.
- Real Navigator `granite-3.3-8b-instruct`, upstream `https://api.ai.it.ufl.edu`, forwarded unchanged through a loopback-only capture proxy. No model response is substituted except the four explicitly injected 503 responses described below. Authorization headers and API keys are never recorded. All 75 real upstream attempts returned 200; raw request/response bodies are preserved in `navigator-attempts.jsonl`.
- Dedicated local PostgreSQL 17.10 on `127.0.0.1:55439`, fresh `case3_live` database. All five existing migrations applied only to this new local database. Existing remote database URLs were not used. PostgreSQL runtime installed under ignored `dev-output/local-postgres`, without application dependency/lockfile changes.
- Existing Clerk development test user authenticated through a short-lived backend test session, revoked after each run. Normal protected app API routes were used. No authentication bypass or production identity was introduced. UI sign-in was not exercised.
- First host-configuration attempt hit Next proxy errors before conversation execution: seven setup 500s and one pending setup when interrupted. Preserved unchanged in `live-setup-host-errors.json`. Corrected the local start host/base URL and started a separately labeled run; no scored result was retried away.
- Request intents are written before transmission. Every attempt records its exact question, complete prior context, response, request/encounter IDs, database state, persisted turn and emission records. No stochastic scenario was repeated until it passed.

## Results

Fourteen fresh encounters, 73 conversation attempts: 72 final responses and one intentionally failed generation request. Thirteen scenarios are in `live-results.json`; the additional extraction paraphrase is in `live-extraction-paraphrase.json`. Every final response was read against its supplied conversation and case facts; API success or a keyword alone was not used as a pass.

| Coverage | Result |
| --- | --- |
| Original production sequence, including all three original opening questions | 5/5 PASS; each emitted first follow-up on consent and exactly one durable Why on confirmation |
| Confirmation paraphrase | PASS |
| Temporary-treatment explanation only | PASS; Why remains eligible |
| Definitive-treatment explanation only | PASS under unchanged rule requiring both explanations |
| Complete explanation and complete formal paraphrase, same turn | 2/2 PASS; no Why on explanation turn |
| Subsequent bare confirmation after those complete explanations | 2 FAIL against whole-conversation already-answered expectation; existing current-turn rule permits it |
| Complete explanation during consent, then bare confirmation | Current-turn contract PASS; whole-conversation already-answered finding FAIL |
| Injected classifier failure then one planned new request | PASS: no question consumed; safe first answer retained; later request emits once |
| Injected generation failure then one planned new request | PASS: HTTP 502, no persisted turn/state/emission change; later request emits once |
| Clinical extraction paraphrase | FAIL under unchanged same-turn contract; new guard discards a valid classifier event |
| Closure | 14/14 acknowledgments, no question or complaint restart |
| API/persistence and request/encounter correlation | 72/72 successful final responses matched stored text, question ID and request/encounter association |

Combined scenario outcomes: **10 PASS, 4 FAIL, 0 ERROR**. Under the unchanged narrower current-turn executable contract alone: **13 PASS, 1 FAIL**. The additional three whole-conversation findings are explicitly separate probes, not retroactive changes to V5/V6/V7/V8 grading. Original production FAIL remains unchanged. The old V8 consent-only control is not claimed as a passing Why test.

The bare original confirmation responses all include Why (exact surrounding acknowledgments vary). For example: `Okay, I understand. I'll make sure to keep my appointment. Thank you. Why?` Each subsequent confirmation has no Why, and the database contains exactly one `c3-follow-up-why` emission per encounter. Some thank-you-plus-Why phrasing is formulaic; functional timing/grounding passed, but this does not establish uniformly ideal naturalness.

## Every remaining non-pass

All cases below follow the standard consent prompt and patient response unless otherwise stated:

Clinician: `You have an abscess. I recommend an I&D to drain the infection and relieve the pressure. Is that okay?`

Patient: `Yes, that’s okay. Even with this treatment, do I still need to see my dentist soon?`

### 1. Complete explanation, then bare confirmation

Scenario `complete-explanation`, full exact trace in `live-results.json`.

Clinician: `Yes, see your dentist promptly. Drainage only relieves the pressure; you still need root canal treatment or extraction to treat the tooth.`

Patient: `Okay, thank you.` (correct same-turn suppression).

Next clinician: `Yes, you still need to see your dentist promptly.`

Actual patient: `Understood, thank you. Why?`

Reason: both reasons were already explained, yet the existing state machine checks only current explanation events. This is not a duplicate emission; the suppressed question was never marked emitted. It is an unnecessary question in the full conversation. Marked as a new whole-conversation finding, not a failure of the existing same-turn rule.

### 2. Complete explanation paraphrase, then bare confirmation

Scenario `complete-paraphrase`, full exact trace in `live-results.json`.

Clinician: `Yes, see your dentist soon. The I&D is temporary. Definitive dental treatment is still required.`

Patient: `Okay, thank you.` (correct same-turn suppression).

Next clinician: `Yes, you still need to see your dentist promptly.`

Actual patient: `Alright, I will make an appointment right away. Thank you for your help. Why?`

Reason: same cross-turn scope limitation as scenario 1. The reason for follow-up exists in the conversation, but no durable answered state suppresses the later question.

### 3. Explanation during consent, later bare confirmation

Scenario `prior-explanation-current-confirmation`, full exact trace in `live-results.json`.

Clinician consent: `You have an abscess. I recommend an I&D to drain the infection and relieve the pressure. This is temporary; you still need root canal treatment or extraction. Is that okay?`

Patient: `Yes, that’s okay. Even with this treatment, do I still need to see my dentist soon?`

Next clinician: `Yes, you still need to see your dentist promptly.`

Actual patient: `Okay, I'll make an appointment as soon as possible. Thank you, doctor. Why?`

Reason: the complete explanation was in the earlier consent turn. This faithfully exercises the existing current-turn rule, but does not satisfy conversation-level already-answered suppression. The scenario's original expected current-turn Why is retained alongside this separate finding.

### 4. Valid extraction paraphrase rejected by the proposed guard

Scenario `extraction-paraphrase`, full trace in `live-extraction-paraphrase.json`.

Clinician: `Yes, see your dentist promptly. The drainage only eases pressure. Your dentist still has to take that tooth out.`

Actual patient: `Alright, I understand. Thank you, doctor. Why?`

Expected: an acknowledgment without Why: both the temporary effect and extraction requirement are explained in the current message. Navigator actually returned all three event flags true, confidence 1, citing `student-current` (also prior context aliases). The guard's `currentCase3Explanations` recognizes the temporary assertion but not `take that tooth out` as extraction. It vetoes a valid definitive-treatment event, and final assembly emits Why. Raw classifier evidence is extracted into `extraction-paraphrase-classifier-evidence.json` and preserved in the complete capture ledger. This is a material defect in the reviewed repair, not a grading ambiguity or upstream failure.

## Review findings and recommendation

The original production failure came from unsupported explanation flags. Commit 3a7b37b constrains current-turn evidence after classification and again inside final assembly. It correctly preserves bare confirmations and transaction boundaries. Its lexical necessary-content veto is too narrow for supported clinical equivalence, demonstrated by scenario 4. Expanding an unbounded list of literal phrases would not establish a reliable shared semantic boundary; revise the evidence validation design and retain this failing live regression before promotion.

The other three findings expose the distinction between current-turn explanation provenance and durable knowledge of an already-given explanation. `stateMachine.ts` reads current events when deciding Why, although accumulated events are stored. V7 `CONTRACT.md` explicitly preserved the executable current-turn rule and its faculty/application authority conflict; the present work did not silently redefine it. Clarify whether a grounded complete explanation should durably mark Why answered (distinct from emitted), including explanations split across turns, before changing that behavior. Never use unsupported old classifier flags as evidence that the clinician actually answered it.

A production failure rollback is not warranted by these local findings; no production mutation was performed. Recommend a further focused repair/review of the demonstrated paraphrase defect and an explicit authority decision on durable answered state, followed by this same live suite. Do not merge this draft as currently validated.

## Automated verification and permanent suite

Original application verification remains **43/43 checks passed**, including typecheck, lint and production build (`checks-final.json`). After adding live infrastructure, focused explanation/final-assembly tests, typecheck and expanded lint were rerun (`review-checks.json`). These checks passing alongside a real live failure demonstrates the additional coverage is necessary.

Permanent executable suite: `scripts/liveCase03FollowUp.mjs`; review/state assertions: `scripts/reviewCase03Live.mjs`; capture/fault proxy: `scripts/case3NavigatorCapture.mjs`; npm entry: `validate:case03-live`. The suite now runs the full original context → consent → confirmation → repeated confirmation → closure, not just consent. It also preserves all four demonstrated non-pass scenarios and exits nonzero for them. Original first responses and intentional failures are not overwritten by planned retries.

For a new run, configure a production server on localhost:3009 using an isolated loopback PostgreSQL database, existing Clerk test keys/user email, Navigator model/key, and `NAVIGATOR_BASE_URL=http://127.0.0.1:3011`. Start the capture proxy with a new `CASE3_CAPTURE` output path, then `next start --port 3009`. Supply `PHASE_T_TEST_EMAIL`, choose a new `CASE3_OUTPUT` path, and run `npm run validate:case03-live`. Optional `CASE3_IDS` selects explicitly labeled scenarios without rerunning completed ones. Existing output paths are refused. Never use production DB credentials. Secrets belong only in ignored environment files, not command output or reports.

No rendered UI comparison, speech playback or human audibility check was performed in this focused API/persistence run. Existing speech evidence is unchanged. No real PostgreSQL concurrency stress test was performed; actual failed-request rollback and existing deterministic rejected-final-assembly tests are distinct evidence.
