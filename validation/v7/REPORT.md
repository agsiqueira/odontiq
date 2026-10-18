# OdontIQ V7 repair and verification

Tested application commit b159cd03a768bf2416d4e3ce19074ee6debf62ba, frozen 2026-10-18T00:41:40.453Z. Branch codex/odontiq-v7. No merge or deployment.

## Authority and behavioral contract

The original faculty documents are clinical authority; the existing catalog/prompt/state machine define the more specific executable question-timing contract. CONTRACT.md records the contract and discrepancies before repair; AUTHORITY.md indexes exact DOCX paragraph locations and executable source paths. Case 1 extraction follows current admission/surgical/OMFS discussion; Case 2 antibiotic-effect follows a current antibiotic recommendation; Case 3 follow-up follows active temporary treatment and Why follows unexplained confirmation of prompt dental follow-up; Case 4 antibiotic-needed follows a current pain/disposition plan unless antibiotics are already recommended/explained unnecessary; Case 5 request follows a substantive sourced current-pain attribute, whether in an opening complaint or later answer. Questions are once only. A clinician invitation or a turn count alone grants no permission. Thanks alone closes the conversational turn.

Faculty/application gaps remain explicit: faculty permits an optional Case 1 antibiotic/discharge request not represented in the catalog; Case 3 faculty sequences its question after drainage agreement, while the existing application permits a wider temporary-treatment trigger; Case 4 faculty does not explicitly prescribe the catalog antibiotic-needed question. V7 preserves the existing executable policy and does not invent a new faculty rule. Faculty clarification is appropriate for those policy differences.

## Repairs and focused verification

Semantic event classification previously treated related background topics as treatment/disposition events. Case 4 now requires an explicit semantic provider-act category and a verbatim current-message plan witness. Case 5 classification is independently constrained by actual sourced pain attributes. Initial generation and corrective output withhold questions while preserving valid answers; final persistence strips questions from the base and adds only a state-selected eligible question transactionally. Rejected classifications do not mark a question emitted. Opening complaints use the same eligibility path.

Source-scoped background contracts distinguish provider relationship from identity and attendance frequency, coverage from actual payment, and a shared-clinic preference from existing provider/child-condition/attendance claims. Care-search offers receive a sourced acknowledgment/preference; unknown requested details retain known portions and explicit uncertainty. Family assertions are checked by subject and provenance, with care-search responses constrained to the turn contract. Single and compound pain questions preserve requested attributes and canonical qualities. A shared plan-only acknowledgment avoids invented practical constraints, preserving governed consent and required factual answers. Scoped cold-resolution negation prevents false application rejections while retaining rejection of genuine immediate-resolution/negative-cold assertions. Case facts remain unchanged. Required-fact fallback now covers only explicitly requested unmapped clinical facts from source, in first-person lay speech; it never substitutes the entire history. Constant-pain checks reject affirmative intermittency. Known child coverage and unknown child condition/provider are assessed in separate clauses, preserving uncertainty without negating the sourced coverage.

Focused iterations (not retries of one frozen application):

|Candidate|PASS|FAIL|REVIEW|ERROR|BLOCKED|Total|Setup responses|
|---|---:|---:|---:|---:|---:|---:|---:|
|1|37|3|0|0|0|40|18|
|2|45|1|0|0|0|46|20|
|3|46|1|0|3|0|50|20|
|4|49|1|0|0|0|50|20|
|5|49|0|1|0|0|50|20|
|6|50|0|0|0|0|50|20|
|7|50|1|0|2|0|53|20|
|8|55|0|0|1|0|56|20|
|9|56|0|0|0|0|56|20|

All first responses, errors, exact contexts and source records are preserved in focused-candidate-*-results.json. Candidate 1 was an exploratory mutable development run; subsequent candidates record commits/hashes and hold application code unchanged during live testing. The last focused candidate passed before the full-run freeze. DEVELOPMENT.md documents root causes and infrastructure/test-fixture changes. Automated: 40/40, including typecheck, full application lint and production build. Initial automated failures remain separate.

## Comparable scored outcomes

One rubric assesses factual grounding, requested-concept completeness, relevance including question timing, and leakage. Natural speech is preserved within those constraints. Every actual final response and setup is reviewed; HTTP success and keyword presence do not award PASS. This is assistant adjudication, not an independent clinician panel. The 546 questions are previously exposed regression data, including cohorts historically named holdout.

|Version|PASS|FAIL|REVIEW|ERROR|BLOCKED|Total|
|---|---:|---:|---:|---:|---:|---:|
|V5 original (historical)|539|5|2|0|0|546|
|V5 corrected|448|95|3|0|0|546|
|V6 audited|456|88|2|0|0|546|
|V7|545|1|0|0|0|546|

All 90 previously missed timing errors were inspected under the explicit contract. The 91 historical V5 corrections (90 timing FAIL, one provider-identity REVIEW) retain original text/verdicts and reasons in prior-grading-audit.json and preserved V6 evidence. V7 made no new prior-version grading changes. Identical text is never credited as behavioral improvement. Regressions from audited V6 PASS: 0. All 539 original V5 PASS IDs and all 456 audited V6 PASS IDs are included in this 546-item rerun.

First scored execution outcomes: {"PASS":545,"FAIL":1,"REVIEW":0,"ERROR":0,"BLOCKED":0}. Retry/original records remain separate in first-attempt-outcomes.json, all-recorded-attempts.json, generation-attempts.json and provider-http-log.json. Per-request ledgers persist sent/received events immediately and prohibit unreconciled duplicate submission after interruption.

## Setup and UI/API coverage

Setup outcomes, separate from scored questions: {"PASS":119,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}, 119 reviewed occurrences. Setup success is never a scored PASS. Development scored UI/API text plus request/encounter correlation: 546/546; setup matches 119/119. Mismatches are enumerated in verification.json.

## Production smoke and speech

Production server http://localhost:3005, command node node_modules/next/dist/bin/next start --port 3005, NODE_ENV=production, Next 16.2.10, build kYqMpyAiWsYJLasiCLmUi, tested commit b159cd03a768bf2416d4e3ce19074ee6debf62ba. Actual provider configuration and env-file hashes (no secret values), build-artifact hashes and harness hashes are in production-configuration.json.

Production scored outcomes: {"PASS":57,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}, total 57. This repeats all three prior production failures and representative repaired behaviors, including timing positives/negatives, setup findings, compound pain, cold-negation and prior focused failures. The production replay of C04-G14-Q19 passed with different text (no antibiotic question); this separate same-source attempt does not erase the development FAIL or demonstrate a repaired version. Production scored provider paths: 56 Navigator and 1 governed-patient-core; setup paths: 14 Navigator and 6 governed-patient-core. These are actual application paths, not claims that every turn invoked generation. Production setup outcomes: {"PASS":20,"FAIL":0,"REVIEW":0,"ERROR":0,"BLOCKED":0}. UI/API and request/encounter matches: 57/57 scored, 20/20 setup.

V6 automated speech playback completed (retained speech-test.json); human audibility remains unverified. V7 changes do not alter speech code. No unrelated speech playback work was repeated; no fresh V7 human-audibility claim is made.

## Freeze and artifact integrity

372 frozen application file hashes, tested commit/configuration and harness hashes are recorded in implementation-freeze.json. verification.json checks source immutability, authoritative facts, baseline evidence, original worktrees, request ledgers, reviewed outcomes, correlation, artifact hashes and retry accounting. Checks passed: 35/35. CSV/screenshot/trace checks are recorded separately.

## Review-recording and execution notes

No prior-version grading changes were made in V7. All 90 previously missed timing corrections retain their corrected verdicts in prior-grading-audit.json. One V7 review-ledger initialization error briefly wrote a default PASS after an intended FAIL override command failed; it was immediately corrected to FAIL. Both entries and the reason remain in review-recording-corrections.json; this was not a behavior change.

One nonfatal development classifier network error on C05-G16-Q18 failed closed; the delivered insurance answer remained correct. No scored item was resubmitted. All initial/corrective candidates and grounded-fallback use are retained in generation-attempts.json and generation-summary.json; these internal attempts are distinct from first delivered-response verdicts.

The remaining development timing defect is a semantic classifier false positive: C04-G14-Q19 was labeled current_plan with the entire fee-openness question as its witness. An exact substring witness does not independently prove a provider plan. This is a residual application defect, not an ambiguous expected answer. The frozen application was not repaired during verification.

## Remaining scored non-passes

### C04-G14-Q19 — FAIL

Question: Is sliding scale payment something you open to?

Context:
Fresh encounter; no prior turns.

Actual final response: I'm open to paying a sliding-scale fee. Do I need an antibiotic?

Reason: relevance: Fresh encounter: only fee openness is asked, no current treatment/disposition plan. Actual response: I'm open to paying a sliding-scale fee. Do I need an antibiotic? The appended question is premature under CONTRACT.md.


## Remaining setup non-passes

None.

## Remaining production non-passes

None.

## Recommendation and paths

Another labeled repair/investigation cycle is recommended for the unresolved findings above. No merge or deployment was performed.

Report: validation/v7/REPORT.md. Machine-readable scored data: results.json/results.csv; non-passes: unresolved-items.json; setups: setup-adjudications.json; production: production-smoke.json; comparison: comparison-v6.json and prior-grading-audit.json; freeze: implementation-freeze.json; completion: completion.json. Raw browser evidence and request ledgers remain in the corresponding C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/odontiq-v7* directories.
