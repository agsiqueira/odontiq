# OdontIQ V8 focused repair and complete verification

Tested application aef3ae11296598d3b41417088d616e3f788fa2aa, frozen 2026-10-18T02:57:50.380Z, branch codex/odontiq-v8. Base application b159cd03a768bf2416d4e3ce19074ee6debf62ba and evidence7e251965649ca189fd4ace4e75ca942ea1003ca7 preserved. No merge/deploy.

## Exact root cause and authority

V7 C04-G14-Q19 was a fresh financial-screening turn. The actual request, trace/network events, source facts, base generation, classifier output and persisted database rows were inspected before edits. Disclosure correctly identified payment_preference and clinicalRequested=false; the generated base was the correct fee answer. The separate question classifier incorrectly asserted current_plan and painManagementOrDispositionDiscussed=true with confidence1, quoting the entire question. V7's substring witness check proved provenance but not a clinical action. Final transactional assembly accepted that event, selected c4-antibiotic-needed-question and appended it. State version1 and the emission row persisted, consuming the once-only question.

Case4 uses current events, so the stored true flag alone does not unlock later turns. The wrong emitted marker persists because a question really was delivered; old V7 encounters/evidence were not rewritten. Trace and DB evidence: trace-evidence.json and v7-persisted-failure-state.json. Exact classifier prompt reconstructed from frozen V7 code, saved turn and empty state: classifier-input-reconstruction.json. V7 did not retain raw provider JSON for the classifier; its parsed result is preserved.

The V7 rubric and authority remain unchanged: validation/v7/CONTRACT.md and AUTHORITY.md. Case4 requires an actual current provider-given pain-treatment/disposition plan. Financial screening, insurance, payment preferences and hypothetical care options cannot independently establish it. A mixed turn with a real clinical plan can. Faculty does not explicitly prescribe the Case4 catalog question/timing; that existing authority gap remains unresolved, along with previously documented Case1/3/5 sequencing differences. No new faculty rule or turn threshold was invented.

## Shared repair and state safety

Semantic classification remains necessary. An independent current-message witness check now requires a clinician directive/current commitment and a clinical action/object, rather than accepting an existing quote or related clinical noun. Financial objects and hypothetical/interrogative options do not grant eligibility; actual clinical actions are checked within their own propositions, preserving mixed financial/clinical turns and financial modifiers of actual referrals. The same constraint runs after classification and again in final transactional assembly. Generation/retry/fallback answers cannot independently emit questions; only eligible final state assembly adds them.

Case4 plan evidence is current-turn state, not a durable unlock. Actual database tests (9 checks) verified failed final validation, invalid generated responses and missing renderable question text write no state/turn/emission; rejected financial and failed classifier turns do not consume/unlock questions; a later valid plan emits; duplicate requests are idempotent; concurrent Serializable finalizations emit once. Existing emission markers remain durable. All test records are synthetic and excluded from participant research. First infrastructure failures and corrected fixture runs are preserved.

## Prefreeze focused verification

- focused-candidate-1-results.json: 74 scored, {"PASS":73,"FAIL":1,"REVIEW":0,"ERROR":0,"BLOCKED":0}; 22 separately reviewed setups.
- focused-candidate-2-results.json: 76 scored, {"PASS":76,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}; 22 separately reviewed setups.
- focused-candidate-3-results.json: 77 scored, {"PASS":76,"FAIL":1,"REVIEW":0,"ERROR":0,"BLOCKED":0}; 22 separately reviewed setups.
- focused-candidate-4-results.json: 77 scored, {"PASS":77,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}; 22 separately reviewed setups.

Every candidate's actual responses/context and source hashes are retained. Repeated original-scenario fresh attempts: 40; counts {"PASS":40,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}. All are planned independent attempts with distinct encounter IDs, not retries until pass. Exact text and outcomes are in repeated-attempt-results.json. Candidate1's additional financial-object probe found that arranging payment for a dentist could pass the first guard; the subsequent repair scopes the direct action/object, with positive controls for actual referral to a sliding-fee clinic. Candidate1 also exposed an unasked severity disclosure in a mixed provider-plan/fee question, repaired by scoping distinct patient-directed requests separately from provider commitments. Candidate2 passed its live suite but two automated checks found that scoping removed the proposal needed for Case3 consent. Candidate3 reuses the existing treatment-consent predicate to retain that context, with explicit unit and live positive controls. Candidate3 live consent then exposed internally inconsistent semantic fields: drainage proposed and agreed true, temporary treatment false, omitting the eligible follow-up. Candidate4 enforces the documented event implication in the shared state machine; either field alone remains insufficient for that implication, with sequential and once-only counterexamples. No expected answer was relaxed. The entire focused suite and repetitions were rerun on the final candidate only after all41 automated checks passed. No per-question answer exception was added. The exact saved V7 parsed false-positive classifier output also passes an explicitly labeled offline replay against final V8: plan event vetoed, answer retained, no question selected or consumed; recorded-classifier-replay.json is separate from live/scored counts.

Automated checks: 41/41, including typecheck, full application lint and production build. Initial fixture and application-check failures remain in automated-candidate-1.json, automated-candidate-2.json and verification-infrastructure-notes.json; they are not silently reclassified as passes.

## Final scored comparison

|Version|PASS|FAIL|REVIEW|ERROR|BLOCKED|Total|
|---|---:|---:|---:|---:|---:|---:|
|V7|545|1|0|0|0|546|
|V8|546|0|0|0|0|546|

All546 exact scored questions and119 setup turns were retained. Regressions against V7 PASS: 0. First delivered-response outcomes: {"PASS":546,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}. No historical grading changes; identical responses are not claimed as behavioral improvement. Internal generation/corrective/fallback attempts and provider HTTP retries are preserved separately from first delivered-response judgments. This is assistant semantic review of exact responses/context/facts, not an independent clinician panel. Previously exposed holdout cohorts are regression data.

Setup outcomes: {"PASS":119,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}, total 119, separate from scored questions. UI/API exact text and request/encounter correlation matched 546/546 scored and 119/119 setups.

## Frozen production smoke

node node_modules/next/dist/bin/next start --port 3007, NODE_ENV=production, URLhttp://localhost:3007, Next16.2.10, buildtzacUzHrQu2NyYCoGizbh, tested commitaef3ae11296598d3b41417088d616e3f788fa2aa. Production repeats all57 V7 smoke cases and additional V8 boundary/sequence controls. Actual configuration, provider paths, env/harness hashes and compiled artifact hashes are recorded in production-configuration.json.

Scored outcomes: {"PASS":68,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}, total 68. Setup outcomes: {"PASS":22,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}, total 22. UI/API and IDs matched 68/68 scored and 22/22 setups. Provider paths: {"navigator":67,"governed-patient-core":1}; actual governed core paths are distinguished from generation.

No unrelated speech work repeated. Retained V6 automated playback was tested; human audibility remains unverified.

Production internal attempt detail: one question-classifier network error occurred on the children setup for FOCUS-C3-CHILD-PROVIDER. It failed closed, preserved the correct final response (Yes, I have a young daughter.), selected no question and left question state at version0. There was no transport/live retry. This internal failure remains in production-provider-http-log.json and production-internal-failure.json; the delivered setup and scored responses passed independently. All other147 production upstream calls returned200.

Actual development configuration: Next16.2.10 development on localhost3006; production uses next start on localhost3007, NODE_ENV=production. Both use Navigator granite-3.3-8b-instruct at the UF API origin, response temperature0.4/maxTokens120 and a30-second request timeout. Exact environment and harness hashes are retained, without exposing secrets.

## Freeze and evidence integrity

409 application file hashes and actual development configuration in implementation-freeze.json. Production build artifacts separately hashed. All prior evidence retained byte-for-byte, original V4/V5/V6/V7 frozen implementations unchanged, authoritative case facts unchanged. Integrity checks: 41/41. CSV round-trip, screenshot existence and trace ZIP integrity checks persisted separately. Full raw request ledgers, screenshots/traces and API evidence remain under C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/odontiq-v8* directories.

## Remaining scored non-passes

None.

## Remaining setup non-passes

None.

## Remaining production non-passes

None.

## Recommendation and artifact paths

No additional behavioral repair is indicated by these finite suites. The documented faculty/application policy gaps still warrant clarification. No merge or deployment.

Report REPORT.md; scored results.json/results.csv; unresolved-items.json; setup-adjudications.json; production-smoke.json; repeated-attempt-results.json; comparison-v7.json; implementation-freeze.json; production-configuration.json; verification.json; completion.json, all under validation/v8/.
