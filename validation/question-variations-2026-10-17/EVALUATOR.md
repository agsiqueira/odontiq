# Evaluation method

The initial runner does not award semantic PASS. It records successful conversations as REVIEW pending individual assistant adjudication. The assistant reads each exact question, required setup, actual setup responses, and final UI/API response against the supplied expected meaning and the current defined patient facts. Explicit per-ID decisions are stored separately, keyed to the raw run ID and response SHA-256. Raw results are never rewritten. This is a language-model-assisted review, not an independent clinician panel or a calibrated statistical classifier.

## Execution checks

- One fresh, server-created dedicated encounter per scored item; real case-card navigation, consultation UI, and exact message submission. The harness checks the fresh encounter ID and initial transcript isolation.
- Real Clerk authentication through the existing Phase T setup and dedicated account. No patient response mocks, direct database access, application imports, or authentication bypass in the Phase T runner.
- Final UI response must equal final API response, with matching request and encounter IDs, HTTP 200, and no visible application error. Actual provider name is retained. The application determines its own initial generation, corrective retry, fact fallback, behavior additions, approved questions, and final guards. Black-box tests do not observe internal raw Navigator generations or count internal provider corrective retries.
- Explicit instruction leakage is automatically flagged using the existing Phase T helper, unchanged. Other role drift, serialization, unsupported details and irrelevant clinical responses are assessed during semantic review.
- ERROR means execution/correlation/API/UI failure. BLOCKED means missing required setup referent or an authentication/provider stop prevented a valid scored execution. These are not semantic patient-response failures.
- The run uses one worker, no harness retries, and at least one second between conversation submissions. Rate limiting triggers a pause honoring Retry-After (minimum 60 seconds), with the attempt preserved. Three consecutive infrastructure errors stop further scored execution rather than substituting a mock. Any continuation or retry must be identified separately.

## Semantic decisions

- PASS requires an answer to the actual requested concept, correct polarity, all parts of a combined question, consistency with defined facts, and no confidently identified unsupported details or leakage.
- An unambiguous contextual short answer is accepted. For example, "No, I'm not" to "Are you insured?" establishes uninsured status. An ambiguous yes/no response to an alternative question is REVIEW.
- Insurance: no current coverage for each adult. Case 02 may accurately describe lost Medicaid. A payment preference or existing appointment alone does not establish insurance status.
- Residence: correct home county, including an unambiguous affirmation of a named county. A bare county is sufficient for a county-residence question. Clinical tooth/pain location is not a residence answer. Incorrect counties fail.
- Case 01 travel: assess capability, transport reliability or willingness as actually asked. Contextual affirmative answers can satisfy a yes/no question without restating every unasked case fact. Merely naming Alachua County fails. Unsupported uncertainty about ability/willingness, conditional ride availability, restrictive distance limits, or denials fail. Pain may add natural distress but cannot change travel facts.
- Defined reliable transportation does not establish ownership of a car, a particular mode of transport, or a named family ride arrangement. A correct capability answer with such a specific invented personal detail still fails the general unsupported-details rule.
- Case 02 Medicaid timing: loss within the past year; relative answers in an established coverage context are accepted. Invented exact months/dates or durations are unsupported. Current Medicaid coverage or loss more than a year ago contradicts the contract.
- Case 02 residency: lives in Collier County, residency not established. Combined questions must address residence and establishment; pure establishment questions can be answered contextually without repeating the county. Documentation, legal or immigration details are unspecified.
- Case 02 transport: unreliable out-of-town transport. Do not equate unreliability with absolute inability to travel or infer reliable local transport, a car, named helpers, or a specific transport arrangement.
- Case 03 combined insurance/dentist: must communicate uninsured adult and existing dentist; an appointment alone cannot replace insurance status. All implied parts of the supplied combined questions remain required.
- Case 03 daughter: child has Medicaid; adult is uninsured. Coverage questions can be answered contextually when the exact question names the plan. Open questions about the insurer require Medicaid, not merely "insured." No exact age, plan attributes, or adult Medicaid coverage is inferred.
- Case 03 shared clinic: preference for care for parent and daughter together; brief contextual assent is accepted. A preference does not establish a categorical refusal of separate clinics.
- Case 04 payment: open to sliding-scale/income-based fees. Pain severity does not answer a financial-scale question. No invented income, eligibility, budget or dollar ceiling.
- Case 05 payment: cannot pay anything and prefers free care. A contextual denial of any payment ability suffices for an ability question; combined preference/ability questions require both. Agreeing to a small fee fails.
- Cases 03–05 transportation is unspecified. Confident invented transport capability/limitations or personal arrangements fail when identified; uncertainty about unspecified details is permitted.
- Known clinical facts are not automatically false when appended, but they cannot substitute for the requested background answer. Ambiguous implied status, uncertain unsupportedness, or genuinely unclear meaning is REVIEW with an explicit reason.
- A catalogued patient question such as "Do I need an antibiotic?" is a question, not an assertion of antibiotic need or a medication history. It does not invalidate an otherwise complete correct background answer, and cannot compensate for a missing background answer. This wording was confirmed in the existing patient-question catalog without modifying it.

## Context protocol

- C02-G05-Q03/Q11/Q16: ask "Have you ever had Medicaid?" then "What happened to that coverage?"; verify prior/lost Medicaid was actually established.
- C02-G06-Q16: ask "What county do you live in?"; verify Collier was established.
- C03-G10-Q14/Q17: ask "Do you have any children?"; verify daughter referent.
- Every G11 question: ask "Do you have any children?" then explain "I'm looking into dental care options for you and your daughter." The setup supplies no preference or expected answer.
- The 20 additional pain-context items use separate fresh encounters, asking "How severe is your pain right now?" and "How are you feeling with the pain?" before the unchanged primary travel wording. Severe pain must actually be established.

Screenshots and scoped Playwright traces are retained for every item, including successes, so later semantic FAIL/REVIEW adjudications retain their original visual/network evidence. Existing regression evaluators and matchers are unchanged. Primary and pain-context cohorts are reported separately. Completeness assertions require 340 unique primary IDs and 20 separate pain-context IDs, each represented once in final result tables; raw attempts and encounter-registration events remain independently available.

## Harness correction and continuation

The initial runner supplied wrong patient-name fixture labels for Cases 03–05. Three Case 03 card-selection attempts failed before any scored conversation request; the safety stop then recorded 197 other primary items and 20 pain-context items as BLOCKED without creating their encounters. These records and the initial HTML report are retained. The fixture was corrected to Elena Garcia, Noah Patel and Sofia Williams. No application change, case-fact change, response matcher change or acceptance-criteria relaxation was made.

The continuation skips every item that already has a correlated final UI/API response, including semantic failures. The three unsuccessful selection items receive fresh setup retry encounters (attempt 2); the other 217 stopped items receive their first actual encounter/execution. Each continuation record links prior run IDs. The final primary table selects the first valid scored response per ID; the initial-run tables retain the original 3 ERRORs and 197 primary BLOCKED items, with the 20 pain-context BLOCKED items separate. No successful or failed scored response was replaced by a better rerun.

An initial summary counter incorrectly counted all raw placeholder records as executed. It was corrected to count only records with an actual final response and request ID; the uncorrected summary is preserved as initial-run-summary-uncorrected-accounting.json. This was an accounting correction, not a response matcher change.
