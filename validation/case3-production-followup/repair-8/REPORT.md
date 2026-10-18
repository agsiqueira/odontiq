# PR #3: one classifier request for Case 3

Tested application **5cf096fb86ebc446a3b8cd995a54771c0007d018**, production build **E-9AI19RUi2x39tFAyjtp**, Node **v24.14.1**, Next **16.2.10**. All **229 frozen application/configuration hashes remained unchanged** during verification. No merge, ready transition or deployment occurred. Production application/settings remain unchanged; dedicated synthetic benchmark records are retained.

The additional serial explanation-verification request has been removed. The existing Case 3 classifier request now returns trigger decisions and separately scoped temporary/definitive explanation evidence. Its sole model is **gpt-oss-120b** (2048-token budget). Patient generation remains **granite-3.3-8b-instruct**. Other cases retain their classifier and generation paths; automated model-isolation and shared-path checks passed.

## Shared repair and preserved correctness

Application code validates the two explanation objects independently: exact schema, finite confidence, threshold for positive evidence, current-message provenance, and nonempty verbatim supporting quotes. Explanation fields cannot inherit trigger flags or confidence. Valid explanation knowledge survives a malformed trigger section without permitting a question decision; malformed whole JSON or invalid explanation evidence fails closed. Durable source-backed explanations, current eligibility checks, once-only emissions and atomic final-response/turn/state persistence remain in place. No keyword list or individual-question response patch was added.

The combined prompt identifies the current clinician message separately from ordered dialogue. Each evidence predicate must be supported by its own explicit current assertion, without borrowing meaning from prior turns or the other predicate. A definitive requirement does not itself explain drainage, and vice versa. State/transaction/authentication/speech implementations and case facts were not changed by this revision.

The initial combined Granite probe was inadequate (four incorrect/incomplete outputs in six requests), so its fast output was not accepted. An exploratory sole-gpt candidate passed final-response checks but trace review caught one invalid temporary witness masked by an earlier valid reason. That candidate, its original verdicts, the corrected evidence verdict, interrupted benchmark and exact read-only attempt recovery are preserved in [repair-7](../repair-7/REPORT.md). The final permanent grader checks current-turn evidence against independently specified fixture meaning as well as final output. This exposes a missed invariant; identical final responses are not counted as behavioral improvements.

## Automated and live results

- **45/45 automated checks**, including typecheck, lint and production build. Additional benchmark/grader infrastructure lint passed.
- **22/22 full live scenarios** through the production build, real Navigator, normal protected APIs and isolated PostgreSQL; **107 conversation attempts**, **106 delivered responses**, one intentionally induced HTTP 502. All exact questions, contexts, responses, persisted turns/state/emissions and request/encounter IDs are in [live-results.json](live-results.json).
- **19/19 ordinary scenarios passed first attempt**, including all five original fresh-encounter sequences. Three separate fault controls retained their first failed attempts and three planned new-turn recoveries. No stochastic rerun hid a failure.
- **22/22 fresh setup requests passed** in the final run. Earlier local binding/setup errors remain separately preserved in repair-7; no scored requests executed during that failed setup run.
- **5/5 independent full-context split-evidence probes** passed before the final live run. Actual PostgreSQL final-assembly rejection/rollback, evidence atomicity, recovery and idempotency passed in **two fresh fixture encounters**.
- Full-suite upstream capture: **120 HTTP attempts** (71 classifier, 49 generation), including four injected 503s and one successful real response whose explanation evidence was intentionally corrupted. All **116 actual Navigator requests returned 200**. There were **zero separate explanation requests**. See [run summary](live-run-summary.json) and [raw captures](navigator-attempts.jsonl).

The old verifier-only transport fault now tests malformed explanation evidence in the shared response; the classifier transport control separately tests its bounded 503 retry. Both withhold the question without consuming eligibility. Generation failure returns 502 without a persisted turn. Existing transport policy retries only 502/503/504 once inside the same 30-second abort budget; no semantic-model fallback was added.

## Matched end-to-end API latency and correctness

Five repetitions of three scripts (original, complete explanation, split explanations), **15 fresh encounters and 80 conversation requests per target**. Target order alternated, requests ran sequentially, and the full live suite did not overlap the benchmark. Each version retained its own actual dialogue history. No benchmark-driven retries were made; existing application repair/retry paths remained active and their requests are counted.

| Target | Correct encounters | API median | API p95 | Model HTTP requests |
| --- | ---: | ---: | ---: | ---: |
| Deployed V8 | 5/15 | 0.925 s | 1.942 s | 110 |
| Local production candidate | 15/15 | 6.453 s | 13.052 s | 95 |

Excluding closure turns, median/p95 were **1.060/2.000 s** for V8 and **7.031/13.359 s** for the candidate (65 requests each). The candidate's 95 captured requests were **60 gpt-oss classifier + 35 Granite generation**, with no separate explanation call and no non-200 response. V8's 110 provider-attempt log entries all reported 200; model identity follows deployed source and verified configuration (Granite). Thus HTTP success was not a correctness pass. V8 missed Why in all five original sequences and produced an irrelevant history dump instead of consent/follow-up in all five split sequences. Complete-explanation cases passed on both versions. These focused criteria do not regrade V8's historical 546-item suite.

**The single-call repair is substantially slower than deployed V8. Removing a request did not establish a speed improvement.** The slower semantic model was retained because the fast prototype failed correctness. No wider architecture was introduced to conceal the tradeoff. Latency acceptance remains a release decision; this draft should not be represented as a performance improvement.

Timing is client wall time from authenticated conversation HTTP submission through final JSON, including server authentication, DB, model work, validation and assembly. JWT acquisition, frontend rendering, speech and login are excluded. p95 uses nearest rank; median uses the middle value/pair. This is a small sequential benchmark, not a load test. Local Windows and production Render/Linux have different network/DB/host characteristics, so these numbers are not a controlled estimate of model-only overhead or a production-candidate SLO.

Production counts use Render metadata inside the 80 request windows. Generation request IDs are present; UUID-only classifier operations lack parent encounter/request IDs. No unrelated named operation was observed, but timestamp attribution cannot rule out concurrent classifier-only traffic. Raw production provider content was not captured; actual final API responses and metadata were. Local captures contain every provider attempt and local DB evidence. All 160 benchmark final responses, contexts and failures are preserved in [paired-latency.json](paired-latency.json), with [statistics](paired-latency-summary.json), [production counts](production-model-calls.json), [status metadata](production-model-statuses.json) and [every baseline non-pass](benchmark-nonpasses.json).

## Configuration, limits and review status

Navigator key/base URL requirements are unchanged. The key must access gpt-oss-120b and Granite; production-key access to gpt-oss-120b was verified in the preceding preflight without extracting the key. No new secret/environment variable is required. Optional **NAVIGATOR_CASE3_CLASSIFIER_MODEL** defaults to gpt-oss-120b; changing it requires semantic retesting. **NAVIGATOR_EXPLANATION_MODEL** is no longer read by the application. The production target was and remains service srv-d9a2aq3eo5us739be670, deployment dep-dba5dmajnfac73ee9hkg, V8 commit 69a24fe9fb6d1121e67da8d2ce70cc02b574266c. No schema, migration, dependency or production-setting change was made.

Application-side source checks cannot independently prove semantic entailment; correctness still depends on the model's judgment. The current-message boundary and permanent evidence controls reduce and expose that risk. No claim is made beyond the tested scenarios. Legacy unverified explanation booleans are not backfilled. No concurrency stress test, new full 546-item run, rendered UI comparison, authentication UI test or speech playback was performed. Speech is unchanged; human audibility is not newly asserted. API text/storage/request/encounter consistency passed for all 106 delivered full-suite responses; benchmark API correlation passed for 160/160 requests, with local candidate evidence inspected in DB and production DB evidence not inspected.

No final-candidate non-pass remains in this scope. PR #3 remains a draft for review. The measured latency tradeoff needs explicit consideration before any separately authorized release. PhaseT, unrelated work and the historical interrupted session were untouched. Only newly created exact fixture sessions were revoked; retained benchmark manifests identify their synthetic users and encounter IDs.
