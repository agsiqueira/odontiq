# OdontIQ — 340 question variations and 20 pain-context tests

Generated 2026-10-17T14:54:01.482Z. Execution complete. Test and report only: no application code/fact changes, deployment or historical participant edits.

Primary inventory: **340 rows, 340 unique IDs, 17 groups, five cases**. Executed primary: 340/340. Additional pain-context: 20/20, reported separately. Each final primary ID appears exactly once. Additional raw status/attempt records: 220, comprising retained setup errors/stop records and their continuations, not repeated scored answers.

## Evaluated primary totals by case

| Case | PASS | FAIL | REVIEW | ERROR | BLOCKED |
|---|---:|---:|---:|---:|---:|
| case-01 | 46 | 13 | 1 | 0 | 0 |
| case-02 | 66 | 11 | 3 | 0 | 0 |
| case-03 | 54 | 25 | 1 | 0 | 0 |
| case-04 | 50 | 10 | 0 | 0 | 0 |
| case-05 | 47 | 12 | 1 | 0 | 0 |

## Primary totals by question group

| Group | PASS | FAIL | REVIEW | ERROR | BLOCKED |
|---|---:|---:|---:|---:|---:|
| G01 — case-01 — Dental insurance | 16 | 3 | 1 | 0 | 0 |
| G02 — case-01 — Residence | 14 | 6 | 0 | 0 | 0 |
| G03 — case-01 — Transportation and travel | 16 | 4 | 0 | 0 | 0 |
| G04 — case-02 — Insurance | 15 | 3 | 2 | 0 | 0 |
| G05 — case-02 — Medicaid loss timing | 15 | 5 | 0 | 0 | 0 |
| G06 — case-02 — Residency status | 19 | 1 | 0 | 0 | 0 |
| G07 — case-02 — Out-of-town transportation | 17 | 2 | 1 | 0 | 0 |
| G08 — case-03 — Residence | 16 | 4 | 0 | 0 | 0 |
| G09 — case-03 — Insurance and existing dentist | 8 | 12 | 0 | 0 | 0 |
| G10 — case-03 — Daughter coverage | 16 | 4 | 0 | 0 | 0 |
| G11 — case-03 — Shared clinic preference | 14 | 5 | 1 | 0 | 0 |
| G12 — case-04 — Residence | 15 | 5 | 0 | 0 | 0 |
| G13 — case-04 — Insurance | 19 | 1 | 0 | 0 | 0 |
| G14 — case-04 — Sliding-scale payment | 16 | 4 | 0 | 0 | 0 |
| G15 — case-05 — Residence | 16 | 4 | 0 | 0 | 0 |
| G16 — case-05 — Insurance | 18 | 2 | 0 | 0 | 0 |
| G17 — case-05 — Ability to pay and free care | 13 | 6 | 1 | 0 | 0 |

## Overall and separate context totals

| Cohort | PASS | FAIL | REVIEW | ERROR | BLOCKED |
|---|---:|---:|---:|---:|---:|
| 340 primary tests | 263 | 71 | 6 | 0 | 0 |
| 20 additional Case 01 pain-context tests | 15 | 5 | 0 | 0 | 0 |

## Retained initial-run totals before harness continuation

| Initial cohort | PASS | FAIL | REVIEW | ERROR | BLOCKED |
|---|---:|---:|---:|---:|---:|
| Initial primary run | 112 | 24 | 4 | 3 | 197 |
| Initial pain-context stop records | 0 | 0 | 0 | 0 | 20 |

## Pain-context comparison

All 20 travel wordings are repeated after a brief pain discussion in separate encounters. pain-primary-comparison.json retains paired outcomes and final answers. These are single stochastic observations per wording/context; differences cannot be attributed causally to pain alone. The first setup establishes current 8/10 pain. A historical initial 3/10 answer on the second setup does not replace that current severity.

## Items retained for human inspection

- C01-G01-Q08: Affordability concern without insurance suggests being uninsured, but could be hypothetical; the response does not clearly establish current coverage or directly answer the paying-without-insurance question.
- C02-G04-Q03: Mentions past Medicaid loss and lack of dental visits, suggesting no coverage but not clearly stating current overall insurance status; cannot confidently infer absence of another current plan. Clinical tooth location, where present, does not resolve that ambiguity.
- C02-G04-Q19: Mentions past Medicaid loss and lack of dental visits, suggesting no coverage but not clearly stating current overall insurance status; cannot confidently infer absence of another current plan. Clinical tooth location, where present, does not resolve that ambiguity.
- C02-G07-Q17: Describes trying to obtain dental care and difficulty since Medicaid loss; this may imply access difficulty, but does not clearly distinguish out-of-town transportation reliability from financial/coverage access.
- C03-G11-Q10: Affirms shared care but 'the same clinic where she's on Medicaid' could imply an unspecified existing clinic or merely a clinic accepting the daughter's defined Medicaid. Meaning of the extra clinic assertion is ambiguous; retain for human inspection.
- C05-G17-Q11: Combines uncertainty about affordability with 'I don't have any money right now.' The latter suggests inability to pay, but the answer does not clearly commit to whether even a modest charge is unaffordable; retain the ambiguous meaning for human review.

## Method and configuration

The entire supplied Markdown file was read, including expected meanings, facts and context requirements. Parsing asserts exactly 340 unique IDs, 20 questions in each of 17 groups across five cases. The copied source and inventory.json preserve wording, capitalization and intentional grammar errors byte-for-byte within each question cell; the original document SHA-256 is recorded.
Application root: C:/240 - odontIQ/odontiq. HEAD: edae56cb34e9a99ada0e1e2e10544686b126dd61. This was an existing dirty working tree; application-before.json preserves its initial status and hashes of 213 application files. Final comparison: all hashed application files unchanged. Next.js 16.2.10 development server, localhost:3000, PID 24364, verified checkout command line and active route hashes. All 16 defined background facts were found in the active route bundle. No stale case snapshot was substituted by the harness.
Phase T root: C:/240 - odontIQ/odontiq-phase-t. Playwright 1.61.1, bundled Chromium with Desktop Chrome profile, one worker, retries=0, at least one second between conversation submissions. Existing Clerk development authentication and dedicated account were reused; no credentials appear in result tables.
Command: `npx playwright test --config=playwright.questions.config.ts --project="question variations" --workers=1 --retries=0`. Phase T TypeScript check passed before execution. New isolated config and study spec were added; existing regression matchers and test specs were unchanged.
Every scored question receives a fresh dedicated encounter, navigated through the real case card and conversation UI. Fresh server binding and transcript isolation are checked before setup. The exact scored message is confirmed in the API request. Final UI text must equal final API text; request and encounter IDs, HTTP status and actual provider are retained. There are no mocked patient responses. Grouping in the runner is only reporting/execution organization: 20 variations are never asked consecutively in one encounter.
Context setup is stored separately. Medicaid follow-ups establish prior/lost coverage; “there” establishes Collier; “she”/“your child” establishes the daughter; shared-clinic items establish daughter and dental care for both without stating the preferred answer. The 20 additional travel tests each have a separate fresh encounter with a brief severe-pain discussion before the unchanged travel question. See EVALUATOR.md for exact setup wording and checks.

## Evaluator and interpretation

The recorder initially assigns successful responses REVIEW rather than using a keyword PASS. Each final answer was then individually reviewed by the assistant with its exact question, context and defined facts. Explicit decisions are keyed to run ID and response hash in adjudications.json; raw records are unchanged. EVALUATOR.md documents the rules and limitations. This is assistant semantic review, not an independent clinician panel or calibrated semantic model.
Unambiguous short contextual answers are accepted. Named-county confirmations count for residence; county statements do not count for travel. Combined questions require all requested parts. Parent insurance is kept separate from daughter Medicaid. Known facts cannot be replaced with uncertainty, while unspecified details cannot be invented. Uncertain interpretations remain REVIEW. A financial or transport assertion is not licensed merely by being plausible.
Approximate “about a year”/“last year” coverage loss is treated as compatible with the defined past-year timeframe, as in existing acceptance wording. A specific six-month interval is unsupported. True clinical/background additions do not automatically fail a response that fully answers the question; irrelevant clinical-only answers fail. These conventions are explicit so a reviewer can reassess borderline judgments.
Recorded successful/failed conversation observations (setup plus scored): 449; provider values: navigator; HTTP statuses: 200. The application's initial Navigator generations, internal corrective retry contents, fallbacks and behavior candidates are not separately exposed by the black-box API. This study evaluates the fully assembled final guarded response and does not claim to recover those internal traces.
Runner group completion is not a patient-response PASS. The outcome tables and CSV/JSON semantic decisions are authoritative for this study.

## Recurring failure patterns and proposed fixes — not implemented

Representative recorded answers (all final UI/API text):

| Test ID | Exact question | Final response |
|---|---|---|
| C01-G02-Q12 | For your dental referral, which county do you call home? | I live in Oak County. |
| C01-G03-Q09 | Do you have a dependable way to reach a dental clinic out of county? | I usually rely on my sister to help with that, but she's out of town right now. |
| C02-G05-Q19 | How recent was losing your Medicaid? | I lost it about six months ago. |
| C03-G09-Q04 | Can you tell me about your insurance and your usual dentist? | I don't have insurance and I usually go to Dr. Smith. |
| C03-G10-Q17 | Is she on Medicaid? | I don't think so, we haven't checked for eligibility. |

Patterns below may overlap; counts are observations, not mutually exclusive root-cause diagnoses. No proposed fix was implemented.
### Wrong concept / irrelevant clinical answer (42)

Broaden intent normalization for paraphrases and grammar variants, keep financial/residence/coverage timelines distinct from clinical questions, and require the requested fact rather than any true fact.

C01-G01-Q09, C01-G01-Q11, C01-G01-Q13, C01-G02-Q05, C01-G02-Q14, C01-G02-Q16, C01-G02-Q17, C01-G02-Q20, C01-G03-Q17, C02-G04-Q03, C02-G04-Q09, C02-G04-Q17 … Full ID list: failure-patterns.json.

### Invented facts or unsupported restrictions (20)

Validate unsupported assertions as well as missing required facts, including free-text additions and statements about family transport, residence, dates, finances and coverage ownership.

C01-G02-Q12, C01-G03-Q07, C01-G03-Q09, C01-G03-Q12, C02-G04-Q08, C02-G05-Q19, C02-G06-Q18, C03-G09-Q04, C03-G10-Q01, C03-G10-Q05, C03-G10-Q17, C03-G10-Q20 … Full ID list: failure-patterns.json.

### Combined-question or family-reference gaps (22)

Track every requested slot and bind pronouns to the established person/concept; require completion of both insurance/dentist and other combined questions.

C02-G04-Q03, C02-G04-Q19, C03-G09-Q01, C03-G09-Q03, C03-G09-Q04, C03-G09-Q05, C03-G09-Q08, C03-G09-Q09, C03-G09-Q11, C03-G09-Q13, C03-G09-Q14, C03-G09-Q17 … Full ID list: failure-patterns.json.

### Unsupported uncertainty about known facts (27)

Use unknown-information replies only for unspecified facts; apply complete fact checks to alternate willingness, option and reliability formulations.

C01-G01-Q09, C01-G01-Q13, C01-G02-Q05, C01-G02-Q14, C01-G02-Q16, C01-G02-Q17, C01-G02-Q20, C01-G03-Q07, C01-G03-Q12, C02-G04-Q09, C02-G04-Q17, C02-G07-Q07 … Full ID list: failure-patterns.json.

### Payment ability versus willingness (6)

Preserve the zero-payment boundary across small-fee, reduced-fee, copayment and affordability phrasing. Separate ability to pay from preference or willingness; combined free-clinic/ability questions need both parts.

C05-G17-Q03, C05-G17-Q04, C05-G17-Q05, C05-G17-Q12, C05-G17-Q14, C05-G17-Q17

### Ambiguous responses retained for human review (6)

Review these examples before changing behavior; refine evaluator criteria only with explicit documented justification, without weakening the current regression matchers.

C01-G01-Q08, C02-G04-Q03, C02-G04-Q19, C02-G07-Q17, C03-G11-Q10, C05-G17-Q11

## Setup observations

Setup turns are not part of the 340 scored questions. 24 scored items have separately documented setup defects/limitations. A usable referent does not make an invented setup detail acceptable, and setup text is not treated as an authoritative new case fact.
- C02-G05-Q03: The second setup response invented stopped paperwork and an eligibility decision. Neither detail is defined. The first setup response had already established prior/lost Medicaid, so the pronoun/time reference was usable; score the primary timing answer separately and retain this setup defect.
- C02-G05-Q11: The second setup response invented stopped paperwork. Prior/lost Medicaid was established by the first setup response. This unsupported setup detail is retained separately from the scored timing failure.
- C02-G05-Q16: The second setup response invented stopped paperwork and an eligibility decision. Prior/lost Medicaid was established by the first setup response. This unsupported setup detail is retained separately from the scored timing failure.
- C03-G11-Q04: The second setup response claimed the daughter's teeth were still coming in. Her dentition/age details are unspecified. Daughter identity had already been established, so the primary shared-clinic preference answer is assessed separately without treating this clinical detail as a new case fact.
- 20 pain-context items: second setup answered historical initial 3/10 rather than current feelings, after first setup explicitly established current 8/10. Per-item notes and actual setup text remain in the pain-context CSV/JSON.

## Execution limitations and retained failures

All requested scored items were executed. Playwright automatic retries remained zero. No already-scored patient response was rerun. Three setup/card-selection attempts were retried after correcting the harness fixture, and all original ERROR/BLOCKED records are retained. Authentication or provider errors, if present, retain their original reason and evidence. Rate-limit handling pauses rather than fabricating results.
The initial runner used incorrect patient-name fixture labels for Cases 03–05. Three Case 03 card-selection attempts failed before a scored request; the safety stop recorded 197 remaining primary and 20 pain-context items as BLOCKED without executing them. Correcting only the Phase T fixture enabled continuation. All 140 already-correlated responses, including semantic failures, were skipped and retained. Three failed setup items use attempt-2 fresh encounters; the other 217 stopped items receive their first actual execution. The final evaluated primary table chooses the first valid scored response per ID, with prior attempt IDs/outcomes retained. Initial-run CSV/JSON and summary tables preserve the unsuccessful run; all raw records remain. This was not an application fix or matcher relaxation.
The initial accounting counter counted blocked placeholder records as executed; it was corrected to count actual final responses and request IDs. The uncorrected initial summary is retained alongside the corrected initial-run summary. No patient-response acceptance criterion changed.
The supplied inventory contains no dedicated transportation questions for Cases 03–05. Their outputs were checked for unsolicited invented transportation details; this study does not claim exhaustive transport-intent coverage for those cases.
Auth/session data in private Playwright traces must be handled as test artifacts, not published publicly; result CSV/JSON contains no credentials.

## Deliverables and research exclusion

- primary-results.csv / primary-results.json: exactly one row per primary ID, with exact question, setup turns, actual final UI/API text, outcome/reason, encounter and request IDs, provider and artifact paths.
- pain-context-results.csv / pain-context-results.json: the 20 separate pain-context tests and their primary-ID relationships.
- summary.json, execution-metadata.json, application-before.json, application-after-comparison.json, server.json, active-server-chunks.json and loaded-background-facts.json: accounting, configuration and version evidence.
- export-verification.json: independent CSV/JSON round-trip, exact wording/ID coverage, UI/API equality, encounter uniqueness, failure/REVIEW/ERROR trace ZIP checks, and unchanged application/regression-file checks. All passed.
- all-raw-attempts.json and original Phase T raw/*.json: original automated outcomes and unsuccessful runs. decisions.json/adjudications.json preserve semantic-review provenance.
- initial-run-primary-results.csv/json, initial-run-pain-context-results.csv/json and initial-run-summary.json preserve the initial run, including every ERROR/BLOCKED item before the fixture correction. The final tables clearly identify continuation and setup-retry records.
- research-exclusion.json: **363 deduplicated synthetic encounter IDs**, including any setup, incidental, incomplete or retry encounters observed through encounter-start events. Original registration events remain in Phase T encounters.jsonl.
- Screenshots and scoped traces for every item are retained under C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/question-variations-2026-10-17/screenshots and traces, so every later-adjudicated failure has its original evidence. Exact per-item paths are in CSV/JSON. The Playwright HTML report records group execution only.

Original Phase T raw artifacts: C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/question-variations-2026-10-17. Application code and facts were not fixed; nothing was deployed.
