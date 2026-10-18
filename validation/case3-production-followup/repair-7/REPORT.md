# Exploratory combined-classifier candidate (preserved)

Application: f7ac54b7e70792c18c39e0e8f71445a27c89d07a. This is not the final candidate.

The first Granite combined-schema probe produced four semantically incorrect or incomplete results in six requests. Consent was incorrectly treated as definitive treatment, a hypothetical requirement was accepted, a procedure label was treated as its explanation, and a negated requirement was accepted. All original outputs are in combined-classifier-probe.json. No application-side keyword veto was added to conceal them. A sole gpt-oss-120b classifier passed the six prototype probes, but broader trace inspection subsequently found an evidence defect.

All 45 final automated checks passed. automated-setup-error.json records a runner preload-path escaping failure before tests could execute. automated-first-checks.json preserves the first actual run's outdated Case 3 classifier fixture failure; the fixture was updated to supply the newly required independent evidence fields, retaining its question/state assertions.

live-results.json preserves seven local authentication-proxy setup HTTP 500s and an interrupted eighth setup request. No model requests or scored conversation turns executed in that run. The server was rebound using its established default startup and the replacement full run is separately named live-binding-corrected.json. It recorded 107 attempts and 22/22 final-response contract passes.

Manual semantic trace review identified one internal evidence failure in split-explanations-before-confirmation: the definitive clause was incorrectly used as a temporary-treatment witness. Prior valid temporary evidence masked the defect in final text. semantic-review-correction.json preserves original verdicts alongside the correction: 22 final-response passes, 21 evidence passes and one evidence failure. Identical final text is not a behavioral improvement. The final candidate explicitly separates the predicates and current-message scope; its permanent grader checks per-turn evidence independently of the final answer.

paired-latency.json preserves the interrupted exploratory performance run: five completed encounters and one partial candidate encounter. Its exact owned Clerk session was revoked. interrupted-attempt-recovery.json recovers the committed pending response by its exact recorded encounter/request ID, read-only, without replay or cleanup. These data were not mixed into final-candidate performance statistics. Prior historical interrupted sessions remain untouched.

The final evidence is in ../repair-8/REPORT.md. No production application or configuration was changed; only separately owned synthetic benchmark records were created.
