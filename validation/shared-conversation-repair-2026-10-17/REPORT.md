# OdontIQ shared conversational repair

Generated 2026-10-17T16:46:27.017Z. All 411 planned items accounted for. No deployment, case-fact edits, UI/grading/authentication changes or historical participant edits. The original study remains unchanged.

## Evidence and root cause

Historical evidence consists of exact final UI/API responses with encounter/request IDs. It does not expose historical initial Navigator generations, corrective candidates, fallbacks or behavior intermediates. DIAGNOSIS.md records source findings before implementation; new diagnostic traces are separately labeled. Do not attribute an old final uncertainty statement to a particular historical generation/retry stage without evidence.

Independent lexical intent patterns missed background paraphrases and allowed generic location/duration/radiation intents to win. Referral wording could trigger restricted clinical interpretation. There was no shared subject/reference or complete combined-question contract. Broad fact-level tags released bundled/unrelated facts; required checks protected residence/transport but not the other background concepts. Generic required location/duration checks could then require clinical facts for a background question. The retry reused the same incomplete interpretation and the fallback chiefly handled clinical facts. Existing final assembly validation was retained but previously lacked the missing semantic constraints.

## Shared changes

A typed background turn contract now identifies requested concepts and subjects, resolves limited conversational references, and carries canonical fact provenance and explicit unknown values. Selection, prompts, completeness/contradiction checks and fallback share that contract. Adult insurance and daughter Medicaid, current coverage and coverage-loss timing, residence and residency, transport capability/willingness, and payment ability/preference remain distinct. Background-only turns avoid generic clinical duration/location requirements. Fallback text derives from authoritative facts and requested concepts; there is no table of the 340 answers. Fully assembled dialogue is validated after behavior and approved patient questions. A current-feelings pain follow-up selects current severity rather than initial severity.

Development-only opt-in diagnostics capture the actual synthetic pipeline. The diagnostic header is restricted to the localhost conversation endpoint; it is never sent to Clerk. Public result exports exclude internal prompt/diagnostic payloads. Private traces remain local.

The corrected final version preserves the existing Case 04 immediate dentist response and required access fact, distinguishes prior dentist visits from current status, and deduplicates selected fact IDs. Established-residency formulations and unsupported employment/income assertions found during the pilot were corrected before the final freeze.

Files changed relative to the original dirty-worktree study snapshot:

- src/app/api/conversation/route.ts
- src/lib/patientDisclosure.ts
- src/lib/patientFinalResponse.ts
- src/lib/patientImmediateResponse.ts
- src/lib/patientRoleResponse.ts
- src/lib/patientTurnFacts.ts
- src/lib/patientBackgroundTurn.ts
- scripts/validateSharedBackgroundTurn.ts

Phase T adds an isolated runner/config/inventory and separate artifact directories. Existing regression matcher files are unchanged.

## Comparable primary results

Each cell is **PASS / FAIL / REVIEW / ERROR / BLOCKED**. Original and revised evaluator baselines are separate. Revised judgments do not silently replace original labels.

| Case | Original baseline | Revised evaluator baseline | After repair |
| --- | --- | --- | --- |
| case-01 | 46 / 13 / 1 / 0 / 0 | 45 / 14 / 1 / 0 / 0 | 59 / 0 / 1 / 0 / 0 |
| case-02 | 66 / 11 / 3 / 0 / 0 | 63 / 14 / 3 / 0 / 0 | 80 / 0 / 0 / 0 / 0 |
| case-03 | 54 / 25 / 1 / 0 / 0 | 55 / 24 / 1 / 0 / 0 | 80 / 0 / 0 / 0 / 0 |
| case-04 | 50 / 10 / 0 / 0 / 0 | 47 / 13 / 0 / 0 / 0 | 59 / 1 / 0 / 0 / 0 |
| case-05 | 47 / 12 / 1 / 0 / 0 | 48 / 12 / 0 / 0 / 0 | 60 / 0 / 0 / 0 / 0 |

| Group | Original baseline | Revised evaluator baseline | After repair |
| --- | --- | --- | --- |
| G01 | 16 / 3 / 1 / 0 / 0 | 16 / 3 / 1 / 0 / 0 | 19 / 0 / 1 / 0 / 0 |
| G02 | 14 / 6 / 0 / 0 / 0 | 14 / 6 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G03 | 16 / 4 / 0 / 0 / 0 | 15 / 5 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G04 | 15 / 3 / 2 / 0 / 0 | 15 / 3 / 2 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G05 | 15 / 5 / 0 / 0 / 0 | 15 / 5 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G06 | 19 / 1 / 0 / 0 / 0 | 19 / 1 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G07 | 17 / 2 / 1 / 0 / 0 | 14 / 5 / 1 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G08 | 16 / 4 / 0 / 0 / 0 | 16 / 4 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G09 | 8 / 12 / 0 / 0 / 0 | 9 / 11 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G10 | 16 / 4 / 0 / 0 / 0 | 16 / 4 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G11 | 14 / 5 / 1 / 0 / 0 | 14 / 5 / 1 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G12 | 15 / 5 / 0 / 0 / 0 | 14 / 6 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G13 | 19 / 1 / 0 / 0 / 0 | 17 / 3 / 0 / 0 / 0 | 19 / 1 / 0 / 0 / 0 |
| G14 | 16 / 4 / 0 / 0 / 0 | 16 / 4 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G15 | 16 / 4 / 0 / 0 / 0 | 16 / 4 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G16 | 18 / 2 / 0 / 0 / 0 | 18 / 2 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G17 | 13 / 6 / 1 / 0 / 0 | 14 / 6 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |

| Cohort | After repair |
| --- | --- |
| 340 primary | 338 / 1 / 1 / 0 / 0 |
| 20 separate pain-context | 20 / 0 / 0 / 0 / 0 |
| 51 untouched holdout — first run | 44 / 6 / 1 / 0 / 0 |

The holdout inventory was created after implementation-freeze.json. Freeze verification records any subsequent application changes. No implementation tuning uses the first holdout observations. The original 340 question strings and setup requirements are retained byte-for-byte in the inventory. Each scored item uses a fresh isolated encounter.

## Preserved pilot and systematic final rerun

The first implementation produced 150 completed pilot observations: 147 PASS, 2 FAIL and 1 REVIEW. An independent clinical check then exposed a Case 04 immediate-helper regression. The pilot also observed an invented job-loss explanation and a missed established-residency request. It was stopped, preserving one additional interrupted encounter as ERROR and unexecuted planned items as BLOCKED. Its 51 holdout questions were never executed and were retired unused. pilot-v1 retains its original freeze, inventory, adjudications and every planned outcome; raw screenshots/traces remain in Phase T.

After the shared corrections and restoration of the existing clinical fast path, the entire 340+20 inventory was rerun systematically in new encounters against the final frozen version. This is not selective rerunning of semantic failures. The 51 final holdout questions were newly written after the final freeze, differ from the retired set, and have a separate first-run table. Earlier pilot observations are not overwritten or substituted into final-version results.

## Evaluator revisions and dimensions

EVALUATOR.md documents assistant semantic review and its limitations. Each response has separate factual correctness, completeness, relevance and leakage judgments. Any failed dimension remains visible. Contextually clear short answers count; supplied premises need not be restated. Approved catalog questions are not automatically irrelevant/leakage.

| ID | Original | Revised | Reason |
| --- | --- | --- | --- |
| C01-G03-Q11 | PASS | FAIL | Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure. |
| C02-G07-Q03 | PASS | FAIL | Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure. |
| C02-G07-Q06 | PASS | FAIL | Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure. |
| C02-G07-Q13 | PASS | FAIL | Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure. |
| C03-G09-Q13 | FAIL | PASS | The principal request is dentist status; lack of insurance is a supplied premise. Existing dentist and next-week appointment answer it. |
| C04-G12-Q20 | PASS | FAIL | Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure. |
| C04-G13-Q13 | PASS | FAIL | Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure. |
| C04-G13-Q14 | PASS | FAIL | Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure. |
| C05-G17-Q11 | REVIEW | PASS | Read as a whole, 'I don't have any money right now' unambiguously answers inability to afford the modest fee despite the conversational uncertainty opener. |
| C01-G03-Q11-PAIN | PASS | FAIL | Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure. |

The revised baseline is 258 PASS, 77 FAIL, 5 REVIEW, 0 ERROR, 0 BLOCKED. Original baseline totals remain 263 PASS / 71 FAIL / 6 REVIEW; original pain-context remains 15 PASS / 5 FAIL. Setup defects are assessed separately and never adopted as new patient facts.

## Actual representative final responses

| ID | Final UI/API response | Outcome | Encounter / request |
| --- | --- | --- | --- |
| C01-G02-Q12 | I live in Alachua County. | PASS | 6ff214f1-abf9-4dfd-a6d4-183d451c29bc / case-01-1792252182554-1-response |
| C01-G03-Q09 | Yes, I have reliable transportation and can travel outside Alachua County if needed. | PASS | e865569a-de7a-4b15-907e-5c5ceadd9a37 / case-01-1792252278781-1-response |
| C01-G03-Q15 | I have reliable transportation and can travel outside Alachua County if needed for free or low-cost care. | PASS | 46441908-e11a-4f97-ba2f-9b8f8cb40f4b / case-01-1792252313412-1-response |
| C02-G05-Q11 | I lost Medicaid within the past year. I'm kind of worried. | PASS | 858b1d1a-34b3-4b33-af9f-8400d7bb657a / case-02-1792252531338-3-response |
| C03-G09-Q04 | I don't have insurance. I have my own dentist and I have an appointment with them next week. | PASS | 65cdb178-b231-4e10-bf60-6801684e29cf / case-03-1792252965272-1-response |
| C03-G10-Q17 | Yes, she has Medicaid. | PASS | 856c98d8-27eb-42b7-991f-8bab19bdcc84 / case-03-1792253164096-2-response |
| C03-G11-Q18 | Yes, I'd prefer the same clinic for my daughter and me. | PASS | 7ef9f5f5-8269-49be-bb40-b3e3ceb14668 / case-03-1792253428267-3-response |
| C04-G14-Q13 | I'm open to paying a sliding-scale fee. Do I need an antibiotic? | PASS | 7451193e-9e71-4543-9349-032cd440ba76 / case-04-1792253758958-1-response |
| C05-G17-Q12 | I can't pay anything, and I'd prefer a free clinic. | PASS | 5a268436-b02a-43d8-b3f6-d7c6d5fd2718 / case-05-1792254089466-1-response |
| C01-G03-Q15-PAIN | Yes, I have reliable transportation and can travel outside Alachua County if needed for free or low-cost care. | PASS | 2c56e7f5-cf01-4883-9617-9cc4010f9f07 / case-01-1792254329209-3-response |

## Automated and live checks

| Check | Result |
| --- | --- |
| validateSharedBackgroundTurn | PASS |
| validatePatientBackground | PASS |
| validatePatientBackgroundConflicts | PASS |
| validatePatientTravel | PASS |
| validatePatientResidence | PASS |
| validateResidenceRecovery | PASS |
| validatePatientInstructionLeakage | PASS |
| validatePatientOutputIntegrity | PASS |
| validatePatientInitiatedQuestions | PASS |
| validatePatientBehavioralStages | PASS |
| validatePatientBehavioralPhraseDiversity | PASS |
| validateBehavioralPhraseGovernance | PASS |
| validatePatientMessageIntent | PASS |
| validatePatientResponseRetry | PASS |
| validatePhase5ProgressiveDisclosure | PASS |
| validateCase01Ludwigs | FAIL (exit 1) — AssertionError [ERR_ASSERTION]: A spoken fact must remain available for continuity |
| validateCase02SystemicInfection | PASS |
| validateCase03PeriapicalAbscess | PASS |
| validateCase04NecroticPulp | PASS |
| validateCase05IrreversiblePulpitis | PASS |
| validateCanonicalCases | PASS |
| typecheck | PASS |
| lint | PASS |
| build | PASS |

Additional final clinical check outputs (all eight PASS) are retained in additional-clinical-checks-final.json; the earlier unsuccessful version is preserved in pilot-v1/additional-clinical-checks.json. Phase T TypeScript also passed. Development failures and corrected attempts remain in development-check-attempts.json and development-failure-ledger.json; final passes do not erase them.

Recorded conversation turns (setup + scored): 518; API attempts: 518; providers: navigator; HTTP statuses: 200. Actual internal corrective retries: 100; fact fallbacks: 75; rate-limit attempts: 0. One worker, at least 1000 ms between submissions, zero automatic browser retries. Final UI/API equality and request/encounter correlation are retained per row.

The smoke recorder initially sent its diagnostic header globally, and Clerk JS failed to load on the case page. Two completed selection ERROR records and one interrupted setup encounter remain preserved; the scoped-header retry succeeded. The unsuccessful smoke attempts are not counted as primary patient-response failures or overwritten. All created smoke encounters are included in research exclusion.

## Remaining failures and limitations

The interpreter remains a deterministic linguistic grammar. The output guard combines concept/polarity checks with conservative unsupported-detail/relevance rules; it cannot prove the absence of every invented assertion. It can reject semantically sufficient short generations, causing a corrective retry or a more explicit sourced fallback. These are real application fallbacks following actual Navigator calls, not mocked responses. This tradeoff and provider cost are visible in diagnostic counts.

The Case 01 clinical continuity assertion fails even with the shared interpreter disabled in a reconstructed control; that control is not an archived baseline binary. The Case 04 immediate-helper regression found in the pilot was corrected, and its unchanged suite now passes. No matcher was weakened.

### primary: every non-PASS item

| ID | Outcome | Final response / execution error | Reason |
| --- | --- | --- | --- |
| C01-G01-Q08 | REVIEW | Yes, I don't have insurance, so I'm paying for this out of pocket. | factualCorrectness: Correct uninsured status, but 'I'm paying for this out of pocket' may imply an actual current payment arrangement/history that is unspecified. It may instead describe lack of an insurer; retain the full response for human inspection. |
| C04-G13-Q11 | FAIL | I'm not sure about that coverage history. Do I need an antibiotic? | completeness: Asks whether current insurance should be considered when finding a clinic. Uncertainty about coverage history does not answer the defined current uninsured status.; relevance: Answers an unrequested historical-coverage question. The approved antibiotic question does not cause or compensate for this failure. |

### pain-context: every non-PASS item

| ID | Outcome | Final response / execution error | Reason |
| --- | --- | --- | --- |


### holdout: every non-PASS item

| ID | Outcome | Final response / execution error | Reason |
| --- | --- | --- | --- |
| C01-G02-H03 | FAIL | I'm not sure, I'm just worried about my jaw. | factualCorrectness: Unsupported uncertainty about the defined Alachua County residence.; completeness: Does not identify the home county or answer the indirect residence question.; relevance: Redirects to jaw concern instead of residence. |
| C01-G03-H01 | FAIL | I'm not sure, I'd have to check how much that would cost. | factualCorrectness: The cost-checking clause could concern an unspecified treatment price, or imply unsupported uncertainty about defined travel ability/willingness. Retain full meaning for human inspection.; completeness: Crossing county lines for low-cost care asks travel workability; the reply never affirms the defined reliable transportation or willingness/ability to travel.; relevance: Answers uncertainty about a price rather than the actual travel question. |
| C02-G04-H02 | FAIL | I... I don't know, I didn't check that. | factualCorrectness: Introduces uncertainty and an unsupported claim of not checking coverage despite defined current uninsured status.; completeness: Does not identify current coverage or state that no plan insures the patient. |
| C03-G09-H02 | FAIL | No, I don't have a dental provider. I'm uninsured. | factualCorrectness: Denies having a dental provider, contradicting the existing dentist and next-week appointment.; completeness: The principal request is whether an own dental provider exists, irrespective of insurance. The wrong denial fails; insurance is not mechanically required as a second declaration. |
| C03-G11-H01 | REVIEW | It might be more convenient, but I'm not sure if it would cover all our needs. | factualCorrectness: The caveat about meeting all needs could be a legitimate uncertainty about unspecified clinic capability or an unsupported obstacle to the defined shared-clinic preference.; completeness: Might be more convenient is tentative assent, but the subsequent caveat leaves unclear whether the defined shared-clinic preference is actually affirmed. Do not require the word prefer; retain the full contextual meaning for human inspection. |
| C04-G13-H02 | FAIL | My dental care is covered by my employer's insurance plan. Do I need an antibiotic? | factualCorrectness: Claims employer insurance covers dental care, contradicting the uninsured adult and inventing an employer plan.; completeness: Does not communicate the actual lack of current insurance covering the care. |
| C05-G16-H01 | FAIL | I don't know, that's why I'm here. | factualCorrectness: Unsupported uncertainty about the defined absence of an insurer/current coverage.; completeness: Does not answer whether an insurer is available to cover the visit; known uninsured status is omitted. |

## Files, trace provenance and exclusion

primary-results.csv/json, pain-context-results.csv/json and holdout-results.csv/json contain exact questions, separate setup turns, final responses, dimensions/reasons, encounter/request IDs and screenshot/trace paths. adjudications.json binds each semantic decision to the raw run ID and response hash. trace-index.json correlates new internal diagnostic observations without publishing prompts. Original Phase T raw JSON and scoped screenshots/traces remain in the private artifact directory listed in execution-metadata.json; raw-artifact-manifest.json records checksums. EVALUATOR.md explains privacy and limitations.

research-exclusion.json contains **590 deduplicated new synthetic encounter IDs**, including smoke/setup/interrupted/retry and regression encounters where registered. These are for research exclusion; no historical encounter was edited.

Application HEAD remains edae56cb34e9a99ada0e1e2e10544686b126dd61 with the documented dirty worktree; source hashes, runtime server identity, loaded selected case facts and freeze checks identify the actual tested version. Nothing was deployed.

## Final verification supplement

All 340 primary IDs occur exactly once across 17 groups and five cases. Exact question/setup strings and CSV/JSON round trips passed verification. All 411 final scored encounters used real Navigator, with matching final UI/API text and correlated encounter/request IDs. Nine scored non-PASS items have screenshots and valid scoped trace ZIPs. All 567 preserved raw artifacts passed checksum verification. The deduplicated new synthetic registry contains 590 encounters, including pilot, smoke, interrupted, regression and exact-repeat encounters. The original study registry remains separate.

### Pain context: case and group totals

| caseId | PASS | FAIL | REVIEW | ERROR | BLOCKED |
| --- | --- | --- | --- | --- | --- |
| case-01 | 20 | 0 | 0 | 0 | 0 |

| groupId | PASS | FAIL | REVIEW | ERROR | BLOCKED |
| --- | --- | --- | --- | --- | --- |
| G03 | 20 | 0 | 0 | 0 | 0 |

### Untouched holdout: case and group totals

| caseId | PASS | FAIL | REVIEW | ERROR | BLOCKED |
| --- | --- | --- | --- | --- | --- |
| case-01 | 7 | 2 | 0 | 0 | 0 |
| case-02 | 11 | 1 | 0 | 0 | 0 |
| case-03 | 10 | 1 | 1 | 0 | 0 |
| case-04 | 8 | 1 | 0 | 0 | 0 |
| case-05 | 8 | 1 | 0 | 0 | 0 |

| groupId | PASS | FAIL | REVIEW | ERROR | BLOCKED |
| --- | --- | --- | --- | --- | --- |
| G01 | 3 | 0 | 0 | 0 | 0 |
| G02 | 2 | 1 | 0 | 0 | 0 |
| G03 | 2 | 1 | 0 | 0 | 0 |
| G04 | 2 | 1 | 0 | 0 | 0 |
| G05 | 3 | 0 | 0 | 0 | 0 |
| G06 | 3 | 0 | 0 | 0 | 0 |
| G07 | 3 | 0 | 0 | 0 | 0 |
| G08 | 3 | 0 | 0 | 0 | 0 |
| G09 | 2 | 1 | 0 | 0 | 0 |
| G10 | 3 | 0 | 0 | 0 | 0 |
| G11 | 2 | 0 | 1 | 0 | 0 |
| G12 | 3 | 0 | 0 | 0 | 0 |
| G13 | 2 | 1 | 0 | 0 | 0 |
| G14 | 3 | 0 | 0 | 0 | 0 |
| G15 | 3 | 0 | 0 | 0 | 0 |
| G16 | 2 | 1 | 0 | 0 | 0 |
| G17 | 3 | 0 | 0 | 0 | 0 |

### Additional checks and exact original wording

| Unchanged real-browser regression suite | Scenarios | Turns | Outcome |
| --- | --- | --- | --- |
| background | 5 | 42 | PASS |
| residence-recovery | 11 | 58 | PASS |
| travel-distinction | 5 | 25 | PASS |

All 21 scenarios / 125 turns passed; no regression failures or blocked tests. Playwright recording-group success for the large study is not semantic patient-response success.

| Exact fresh repeat | Question | Final UI/API response | Encounter | Request |
| --- | --- | --- | --- | --- |
| C01-EXACT-01 | can you travel for Affordable Care | I have reliable transportation and can travel outside Alachua County if needed for free or low-cost care. | 74e9a817-41f8-4791-9bc5-f8ad8d570a7a | case-01-1792255399937-1-response |
| C01-EXACT-02 | can you travel for Affordable Care | I have reliable transportation and can travel outside Alachua County if needed for free or low-cost care. | 216a9bac-8ffc-4c1c-93f5-f8ba5ed6ffa5 | case-01-1792255406367-1-response |
| C01-EXACT-03 | can you travel for Affordable Care | I have reliable transportation and can travel outside Alachua County if needed for free or low-cost care. | daf9229f-26c2-495e-ac34-a7b1a4ca8527 | case-01-1792255412001-1-response |

All three repeats passed individual semantic review and used distinct fresh encounters.

Two automated assertions remain unresolved: validateCase01Ludwigs continuity fails in both the current implementation and a reconstructed control with the shared interpreter disabled; this is not proof from an archived baseline binary. validateCase01FacultyFacts fails because “Who do you live with?” unlocks county residence. The retained legacy-selection control selects no fact, demonstrating a newly introduced scope regression. This is automated interpretation evidence, not a live Navigator observation. The additional penicillin and Case 03 allergy checks passed. Eight additional clinical checks passed, including the restored unchanged Case 04 dentist check. App TypeScript, lint, build, and Phase T TypeScript passed. Detailed outputs, including earlier unsuccessful attempts, remain in automated-checks.json, additional-scope-checks-final.json, clinical-control-failures.json and the development failure ledger.

Setup turns were reviewed separately: 106 PASS / 1 FAIL among 107. C03-G11-Q01 setup turn 1 invented a scheduling barrier (“It’s been tough finding time for both of us.”); the required daughter referent was established and the scored answer passed. Its actual trace has intent other, no contract or selected/required facts, and the unsupported statement originates in the initial Navigator output, with no retry/fallback or behavior change. All 20 pain contexts used current pain severity and current-discomfort follow-up. setup-dimensional-review.json retains every setup assessment.

### Evidence boundaries and configuration

Thirteen reconstructed legacy replays accepted the recorded bad final responses through the retained legacy classification/selection/required-fact/guard paths. They are reconstructed source controls, not historical Navigator runs or an archived application binary. Historical records lack intermediate generations. New actual diagnostics identify the remaining primary insurance failure before generation: “when finding a clinic” incorrectly assigns unknown coverage timing, and Navigator follows that contract. The setup failure originates in an unconstrained initial generation. Full evidence is in reconstructed-legacy-replays.json and trace-index.json. The additional diagnostic source file is scripts/replayLegacyBackgroundStudy.ts.

Final implementation freeze: 2026-10-17T15:45:52.619Z; untouched 51-question holdout created 2026-10-17T15:46:01.148Z. All 214 frozen files are unchanged after testing. Loaded runtime background facts matched all 16 canonical facts; case files and existing regression matchers remain unchanged. Server PID 24364 served the application checkout with the corrected hot-reloaded code. HEAD is edae56cb34e9a99ada0e1e2e10544686b126dd61; the dirty-worktree source hashes define the tested implementation.

| Setting | Value |
| --- | --- |
| applicationProvider | navigator |
| navigatorModel | granite-3.3-8b-instruct |
| navigatorOrigin | https://api.ai.it.ufl.edu |
| credentials | Loaded through existing environment; neither read into reports nor printed |
| application | Next.js 16.2.10 |
| conversationTemperature | 0.4 |
| conversationMaxTokens | 120 |
| providerTimeoutMs | 30000 |
| playwrightVersion | 1.61.1 |
| browserProfile | Desktop Chrome (bundled Chromium) |
| workers | 1 |
| automaticBrowserRetries | 0 |
| submissionMinimumIntervalMs | 1000 |
| authentication | Existing Phase T Clerk setup and dedicated account; credentials redacted |

The final 411 scored plus 107 setup turns made 518 successful conversation API requests, with 100 corrective generations and 75 fallbacks (618 conversation generations total). These figures exclude separate patient-question classifier calls. Not all corrected generations were hallucinations: conservative guards sometimes rejected sufficient short answers. No final rate-limit attempts occurred. Each scored item has one final-version observation; the assistant authored and semantically reviewed the holdout, so this is not an independently calibrated evaluation panel.

Pilot first-version completed responses: 147 PASS / 2 FAIL / 1 REVIEW, plus one interrupted ERROR encounter and 189 unexecuted primary BLOCKED items. Its 20 pain tests and retired unused 51-question holdout were BLOCKED. The final version reran the complete primary and pain inventories and used a newly created holdout. Smoke attempts retained two completed ERROR records, one interrupted setup encounter, five planned BLOCKED items, and one scoped-header retry PASS. The two interrupted attempts lack a complete captured result/trace; their encounter IDs remain in the registry. Original baseline unsuccessful runs and matcher judgments remain unchanged; evaluator revisions are separately documented.

### Recurring patterns and proposed next work — not implemented

| Pattern | Evidence | Proposed change |
| --- | --- | --- |
| Indirect background wording remains unrecognized or misclassified | Six untouched-holdout FAILs, including false dentist denial and employer insurance. Exact responses and dimensions are retained. | Broaden interpretation at the concept/argument level: normalize insurance morphology and care-provider synonyms, identify mobility expressed through crossing/trips, and distinguish a residence-place argument from a household-person argument. Retain a constrained concept/subject contract and canonical provenance; avoid exact-question lookup tables. |
| Temporal clause attaches to care planning rather than coverage history | New actual trace maps current insurance wording with 'when finding a clinic' to unknown coverage_timing, and Navigator follows that incorrect contract. | Scope temporal interpretation to the coverage event being asked about; a subordinate future care-planning clause must not change a current coverage question into historical timing. |
| Unsupported assertions escape when no background contract is assigned | False employer insurance/provider denial and invented scheduling difficulty. The setup trace shows intent other, empty selected/required facts, initial Navigator invention, no retry/fallback, and unchanged behavior candidate. | Apply canonical contradiction and unsupported-assertion checks independently of successful question classification, including neutral acknowledgements. Keep adult/daughter subjects separate and permit generic emotions without inventing concrete personal circumstances. |
| Ambiguous payment history or clinic-capability caveat | Two final-version REVIEWs retain full responses. Out-of-pocket wording may imply an unspecified payment arrangement; clinic-needs caveat may or may not affirm the defined preference. | Keep review-level uncertainty visible; constrain unsupported concrete arrangements while accepting unambiguous contextual answers and reasonable preference explanations. |
| Unspecified household question mistaken for county residence | The unchanged automated scope check fails on 'Who do you live with?'. This is a new interpretation regression, not a live patient observation. | Resolve the requested argument (person versus place) before selecting residence; unspecified household details must stay unknown. |
| Conservative validator causes avoidable retries/fallbacks | 100 actual corrective generations and 75 fallbacks across 518 final-version conversation turns. Some initial generations are semantically adequate short contextual answers but rejected by existing explicit fact matchers. | Improve clause/subject-aware validation while preserving factual, completeness, relevance and leakage criteria; do not relax existing regression matchers merely to improve totals. |

No changes were made after the final freeze to chase these failures. The implementation is not a complete resolution of all conversational or automated acceptance criteria. Nothing was deployed.
