# PR #3 final focused repair and verification

All four original live failures are resolved. The final frozen candidate completed the full permanent suite: **22 PASS / 0 FAIL / 0 ERROR**, with no unresolved items. Earlier failures are preserved, not replaced by this result.

## Tested application and configuration

- Application commit: `f389347590c92f1cfeb1f7425bd48950bfd243fb`; branch `codex/case3-followup-evidence`.
- Node v24.14.1, Next 16.2.10; optimized production build `vgAU3DiNCrJlofz2Iyfsa`, served by `next start --port 3009`.
- Real Navigator at https://api.ai.it.ufl.edu through a loopback capture/fault proxy. Patient generation and trigger classification: `granite-3.3-8b-instruct`. Independent explanation verification: **`gpt-oss-120b`**, default or optional `NAVIGATOR_EXPLANATION_MODEL`. This new model dependency is explicitly part of the proposed change.
- Isolated loopback PostgreSQL 17.10 and existing Clerk development test authentication. No production endpoint or remote database was written. No production configuration changes, merge, deployment or rollback.
- All **229 frozen source/schema/configuration hashes remained unchanged** throughout verification. See [freeze.json](freeze.json) and [completion.json](completion.json). Subsequent report/evidence commits do not change application behavior.

## Shared root causes and repairs

The old guard tied explanation recognition to a narrow vocabulary. That veto discarded an actual clinician explanation of tooth removal even when the classifier understood it. It is replaced by a current-message-only semantic verifier that accepts clinical equivalents and requires a verbatim clinician witness for each accepted fact. No individual-question exception or growing accepted-phrase list is used.

The old Why decision tested current explanation flags rather than durable answered knowledge. Validated temporary-effect and positive definitive-treatment requirement witnesses now persist independently, with source message IDs and quotes, in the existing transactional question state. Both must be known to suppress Why. One never implies the other; a bare instruction to visit the dentist establishes neither. Legacy boolean flags alone are not trusted as explanation evidence.

Trigger decisions and explanation knowledge are separate protocols. The existing Granite trigger schema remains strict and unchanged. Explanation evidence is considered at every Case 3 stage, including before consent. If trigger JSON is rejected but independently validated knowledge is available, that knowledge may persist with the final validated answer while `questionDecisionVerified=false` prevents any question emission. Provider failures, missing/fabricated positive witnesses and low-confidence positive assertions cannot consume a question. Each accepted positive witness still requires confidence >=0.85. False/empty decisions and quoted counterexamples are not suppressing evidence.

The same constraint runs after classification and during final assembly. Knowledge and emission commit only with a valid final answer in the existing serializable transaction; duplicate request handling and durable once-only emission remain intact. No migration is required.

The expanded controls also exposed a consent helper requiring an effect explanation and missing the existing I&D action in its treatment-subject check. Faculty rules require an actual drainage proposal plus agreement, not a purpose explanation as a prerequisite to consent. Reusing the existing drainage-action recognizer and removing that extra prerequisite fixes the routing boundary, including mixed consent/definitive-explanation messages. Case facts and faculty specifications are unchanged.

## Authority and grading

The user's explicit instruction to preserve validated explanations across turns resolves the prior current-turn-only suppression gap. [repair-2/CONTRACT.md](../repair-2/CONTRACT.md) records that authority and the explicit expectation changes. The original definitive-only fixture already explained drainage during consent; with durable memory, its later definitive explanation completes both reasons. A separate definitive-without-temporary fixture keeps the genuine one-reason counterexample and still emits Why. Historical verdicts remain untouched. Identical text is not claimed as a behavioral improvement.

The broader faculty/application discrepancy over which temporary treatments enable the FIRST follow-up question remains documented in the V7 contract; this repair does not redefine it.

## Exact final outcomes

The complete permanent suite contains 22 fresh encounters and **107 conversation attempts**. Every final response was read for relevance, factual grounding and question timing against its full recorded conversation. There are 106 successful final responses and one deliberately injected generation error; HTTP success alone is not a semantic pass.

- **19/19 ordinary scenarios passed on their first attempts.** No automatic scenario retries or repeated requests until pass.
- The required original sequence passed in **five independent fresh encounters**, including the original three background questions, consent, confirmation, repeat confirmation and closure. Each emitted the first follow-up on consent and exactly one Why on confirmation.
- Three deliberate fault scenarios tested trigger-classifier failure, explanation-verifier failure and generation failure. Each initial outcome is preserved separately. The first two returned safe HTTP 200 acknowledgments without Why; generation returned HTTP 502 and persisted no turn. None consumed the question. Each had exactly one planned NEW-TURN retry, which emitted Why once; a later confirmation did not repeat it. This is not reported as first-attempt conversational success. Request IDs, exact texts and statuses are in completion.json and the raw ledger.
- Two separate fresh preflight encounters also passed (original sequence and split-turn explanation). They are separate from the 22-scenario result.
- Including preflight: 208 real Navigator attempts, all HTTP 200, plus six explicitly injected 503 attempts (two bounded transport attempts for each fault). Actual request models: 131 Granite and 77 gpt-oss-120b calls. No unexpected upstream errors.
- All **106/106 successful full-suite final responses** matched persisted text, selected question ID and encounter/request correlation. All retained explanation witness occurrences were matched to actual clinician messages in their own encounters.

The four original failures now deliver these exact final responses at their failing points:

| Original failure | Actual final response | Outcome |
| --- | --- | --- |
| complete-explanation | `Understood, thank you. I will make an appointment as soon as I can.` | PASS; no Why emitted |
| complete-paraphrase | `I understand, thank you.` | PASS; no Why emitted |
| prior-explanation-current-confirmation | `Okay, I'll make an appointment as soon as possible. Thank you, doctor.` | PASS; no Why emitted |
| extraction-paraphrase | `Alright, I understand. I'll make an appointment as soon as possible. Thank you, doctor.` | PASS; no Why emitted |

Complete context and every response are in [live-results.json](live-results.json). Source-witness checks and semantic review are in [semantic-review.json](semantic-review.json); structural/state assertions are in [live-results-adjudication.json](live-results-adjudication.json). **No remaining non-pass items in the final suite.**

## Automated and transaction coverage

**45/45 automated checks passed**, including existing regression checks, typecheck, expanded lint and production build. New regressions cover actual classifier/final-assembly calls, paraphrase witnesses, independent and split-turn reasons, initial-stage knowledge, legacy flags, rejected trigger decisions, closure, once-only emission, rejection rollback, retries and idempotency. Model-override coverage proves patient generation keeps its configured model and public-like model input is not forwarded. See [automated-checks.json](automated-checks.json). The build emitted the existing nested-worktree multiple-lockfile root warning; compilation, type checking and static generation succeeded without changing Next configuration.

A separate real isolated-PostgreSQL check of the unchanged final-assembly/eligibility/state implementation passed emission and explanation rejection rollback, same-request recovery and idempotency in two fixture encounters. [Database evidence](../repair-5/database-rollback.json) is distinct from the live Navigator suite; it uses deterministic fixtures. In-memory rollback tests and real database tests are not conflated. No concurrency stress test is claimed.

## Preserved development failures

| Candidate | Scope | PASS | FAIL |
| --- | --- | ---: | ---: |
| Original PR review (3a7b37b application) | 14-scenario review | 10 | 4 |
| repair-2 | Expanded 22-scenario suite | 1 | 21 |
| repair-3 | Expanded 22-scenario suite | 18 | 4 |
| repair-4 | Expanded 22-scenario suite | 21 | 1 |
| repair-5 | Expanded 22-scenario suite | 7 | 15 |
| repair-6 / final | Same 22-scenario suite | 22 | 0 |

These aggregates have different historical scope/authority where explicitly noted; the original 14-item review is not silently regraded. Earlier model/schema failures, setup failures, first attempts, raw classifier decisions, probe outcomes and exact final responses remain in their versioned directories. Intermediate preflight successes did not erase full-run failures. The local database wrapper setup error executed no conversation requests and is separately preserved.

## Remaining limitations and next action

The proposed verifier model introduces availability and latency dependence and a 2048-token verification budget. Before any separately authorized production deployment, confirm the production Navigator key can access gpt-oss-120b; only the local test key was used here. Changing the verifier model requires semantic retesting. No silent fallback to a weaker model is implemented.

The full 546-item suite, rendered UI comparison and speech playback were not repeated in this focused cycle. Human audibility is not asserted. No authentication UI test was performed; normal protected APIs used Clerk test sessions. Some thank-you-plus-Why phrasing remains formulaic. Semantic-model reliability outside these controls is not guaranteed. Existing encounters are not backfilled from unverified historical explanation booleans.

PR #3 remains for review. Production is unchanged. The historical interrupted session is unchanged; no timestamp-based cleanup was attempted. Each completed new runner revoked only its own precisely identified session. No merge or deployment was performed.
