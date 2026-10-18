# OdontIQ shared conversational follow-up

Generated 2026-10-17T18:11:29.980Z. Every planned item has a recorded attempt. No deployment, additional service, case-fact change, authentication/UI/grading change, or historical participant edit. Current and previous raw results are separate.

## Root causes and changes

The actual prior traces distinguish interpretation defects from generation defects. The current-insurance question was assigned coverage_timing solely because it contained “when”; “when finding a clinic” scopes to care planning. Temporal interpretation now requires duration/history wording or a coverage transition event. County-place wording and crossing county boundaries now identify residence or travel; person/household arguments explicitly remain unknown and select no residence fact. Insurance morphology and coverage verbs recognize insurer/insures/covers. Existing dental-provider wording maps to the dentist concept, while an insurance premise introduced by whether/regardless/even-if does not require mechanical restatement. These are shared concept rules, not exact-question answer tables.

Prior employer insurance and existing-dentist denial originated in initial Navigator output and passed without retry. The unsupported scheduling barrier also originated in the initial generation with intent other and no contract. A validation-only canonical assertion guard now runs independently of interpretation on initial and corrective generations, presentation candidates, and the fully assembled final response after behavior and approved patient questions. It rejects contradictory adult insurance/provider assertions and unsupported concrete employment, scheduling, financial and transport-family arrangements. It returns only a validation result, not unrelated facts to reveal. Natural emotions, acknowledgements, contextual answers and patient questions remain permitted. The guard is deliberately bounded and does not prove absence of every possible invented statement.

Continuity was investigated separately against actual revision edae56cb34e9a99ada0e1e2e10544686b126dd61, extracted verbatim with its case facts and unchanged script. That actual revision passes the assertion; the earlier reconstructed-control failure did not establish that this issue predated repair. In the earlier revision, already-spoken drooling is not reselected. The accumulated working tree reselects it, and the previous alreadyDisclosed predicate excluded selected facts, losing the continuity record. Disclosed status is now retained independently of current selection; a question alone still does not establish disclosure. continuity-diagnosis.json records both actual states and the reconstructed former predicate.

Files changed in this follow-up: src/lib/patientBackgroundTurn.ts; src/lib/patientCanonicalAssertions.ts (new); src/lib/patientDisclosure.ts; src/lib/patientFinalResponse.ts; src/app/api/conversation/route.ts; scripts/validateSharedConversationFollowup.ts (new); scripts/validateSharedBackgroundTurn.ts (output-path override only, assertions unchanged). The existing Phase T recorder and regression matchers are reused unchanged with a new isolated config/output directory. The preexisting dirty worktree is retained.

## Before/after cohorts

All count cells are **PASS / FAIL / REVIEW / ERROR / BLOCKED**. Former holdout questions are now regression data; the new post-freeze holdout has a separate first-run table.

### primary

| Cohort | Before | After |
| --- | --- | --- |
| primary | 338 / 1 / 1 / 0 / 0 | 336 / 2 / 2 / 0 / 0 |

| caseId | Before | After |
| --- | --- | --- |
| case-01 | 59 / 0 / 1 / 0 / 0 | 59 / 0 / 1 / 0 / 0 |
| case-02 | 80 / 0 / 0 / 0 / 0 | 79 / 0 / 1 / 0 / 0 |
| case-03 | 80 / 0 / 0 / 0 / 0 | 78 / 2 / 0 / 0 / 0 |
| case-04 | 59 / 1 / 0 / 0 / 0 | 60 / 0 / 0 / 0 / 0 |
| case-05 | 60 / 0 / 0 / 0 / 0 | 60 / 0 / 0 / 0 / 0 |

| groupId | Before | After |
| --- | --- | --- |
| G01 | 19 / 0 / 1 / 0 / 0 | 19 / 0 / 1 / 0 / 0 |
| G02 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G03 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G04 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G05 | 20 / 0 / 0 / 0 / 0 | 19 / 0 / 1 / 0 / 0 |
| G06 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G07 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G08 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G09 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G10 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G11 | 20 / 0 / 0 / 0 / 0 | 18 / 2 / 0 / 0 / 0 |
| G12 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G13 | 19 / 1 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G14 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G15 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G16 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |
| G17 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |

| Dimension | PASS | FAIL | REVIEW | NOT_ASSESSED |
| --- | --- | --- | --- | --- |
| factualCorrectness | 337 | 1 | 2 | 0 |
| completeness | 339 | 1 | 0 | 0 |
| relevance | 339 | 1 | 0 | 0 |
| leakage | 340 | 0 | 0 | 0 |

- **C01-G01-Q08 REVIEW**: Are you paying for dental care without insurance?
  - Response: Yes, I don't have insurance, so I'm paying out of pocket.
  - factualCorrectness: Correct uninsured status. Paying out of pocket may simply describe no insurer or imply an unspecified actual payment arrangement. This remains an evaluator ambiguity, not a confirmed application defect; raw response retained.
  - Encounter 8066f958-b085-4130-9f69-239506451468; request case-01-1792257226177-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C01-G01-Q08_b6d4fa6a-53e4-48ed-9918-71f59787f935.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C01-G01-Q08_b6d4fa6a-53e4-48ed-9918-71f59787f935.zip.
- **C02-G05-Q20 REVIEW**: Your Medicaid ended when?
  - Response: It's been a while, I think within the last year. I can't quite remember.
  - factualCorrectness: States within the last year, but I think / cannot quite remember may hedge the defined interval or refer only to an unspecified exact date. No employment story or alternative interval is invented. Retain for human semantic review rather than enforcing rigid wording.
  - Encounter 92aff4c9-1b83-45c8-87f8-52fa4db1f59a; request case-02-1792257788106-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C02-G05-Q20_7f87c1e5-a6f5-4ca4-8b3f-79d918f53007.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C02-G05-Q20_7f87c1e5-a6f5-4ca4-8b3f-79d918f53007.zip.
- **C03-G11-Q08 FAIL**: Would a clinic accepting your daughter on Medicaid and seeing you uninsured suit your preference?
  - Response: My daughter has Medicaid.
  - completeness: Asks whether a clinic seeing the uninsured parent and Medicaid-covered daughter suits the shared-care preference. Daughter Medicaid alone does not answer preference.; relevance: Responds only to supplied coverage context rather than the requested shared-clinic preference; approved questions are not the issue.
  - Encounter 77b650bf-f06b-478b-8a7d-0c3d22240038; request case-03-1792258487269-3-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C03-G11-Q08_037b6850-d8ac-49a6-9df9-fba62276b350.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C03-G11-Q08_037b6850-d8ac-49a6-9df9-fba62276b350.zip.
- **C03-G11-Q13 FAIL**: Would you like me to look for somewhere that can treat you both?
  - Response: Yes, please. It would be easier if we could go to the same clinic for both of us. My daughter's on Medicaid, so she sees a dentist at a certain clinic. I'd prefer the same one for us too.
  - factualCorrectness: The shared-clinic preference is answered, but claiming that the daughter sees a dentist at a certain clinic invents an existing clinic/provider history. Daughter Medicaid and preference do not establish that history.
  - Encounter c78b5003-2500-45f0-93aa-8a8ca815d41f; request case-03-1792258549595-3-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C03-G11-Q13_8c88c492-1d0f-4b08-80a1-0edf4e353f64.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C03-G11-Q13_8c88c492-1d0f-4b08-80a1-0edf4e353f64.zip.

### pain-context

| Cohort | Before | After |
| --- | --- | --- |
| pain-context | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |

| caseId | Before | After |
| --- | --- | --- |
| case-01 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |

| groupId | Before | After |
| --- | --- | --- |
| G03 | 20 / 0 / 0 / 0 / 0 | 20 / 0 / 0 / 0 / 0 |

| Dimension | PASS | FAIL | REVIEW | NOT_ASSESSED |
| --- | --- | --- | --- | --- |
| factualCorrectness | 20 | 0 | 0 | 0 |
| completeness | 20 | 0 | 0 | 0 |
| relevance | 20 | 0 | 0 | 0 |
| leakage | 20 | 0 | 0 | 0 |


### former-holdout-regression

| Cohort | Before | After |
| --- | --- | --- |
| former-holdout-regression | 44 / 6 / 1 / 0 / 0 | 51 / 0 / 0 / 0 / 0 |

| caseId | Before | After |
| --- | --- | --- |
| case-01 | 7 / 2 / 0 / 0 / 0 | 9 / 0 / 0 / 0 / 0 |
| case-02 | 11 / 1 / 0 / 0 / 0 | 12 / 0 / 0 / 0 / 0 |
| case-03 | 10 / 1 / 1 / 0 / 0 | 12 / 0 / 0 / 0 / 0 |
| case-04 | 8 / 1 / 0 / 0 / 0 | 9 / 0 / 0 / 0 / 0 |
| case-05 | 8 / 1 / 0 / 0 / 0 | 9 / 0 / 0 / 0 / 0 |

| groupId | Before | After |
| --- | --- | --- |
| G01 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G02 | 2 / 1 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G03 | 2 / 1 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G04 | 2 / 1 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G05 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G06 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G07 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G08 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G09 | 2 / 1 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G10 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G11 | 2 / 0 / 1 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G12 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G13 | 2 / 1 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G14 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G15 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G16 | 2 / 1 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |
| G17 | 3 / 0 / 0 / 0 / 0 | 3 / 0 / 0 / 0 / 0 |

| Dimension | PASS | FAIL | REVIEW | NOT_ASSESSED |
| --- | --- | --- | --- | --- |
| factualCorrectness | 51 | 0 | 0 | 0 |
| completeness | 51 | 0 | 0 | 0 |
| relevance | 51 | 0 | 0 | 0 |
| leakage | 51 | 0 | 0 | 0 |


### targeted-live

| Cohort | Before | After |
| --- | --- | --- |
| targeted-live | No prior run | 27 / 2 / 1 / 0 / 0 |

| caseId | Before | After |
| --- | --- | --- |
| case-01 | — | 6 / 0 / 0 / 0 / 0 |
| case-02 | — | 5 / 1 / 0 / 0 / 0 |
| case-03 | — | 5 / 0 / 1 / 0 / 0 |
| case-04 | — | 5 / 1 / 0 / 0 / 0 |
| case-05 | — | 6 / 0 / 0 / 0 / 0 |

| groupId | Before | After |
| --- | --- | --- |
| TARGET | — | 27 / 2 / 1 / 0 / 0 |

| Dimension | PASS | FAIL | REVIEW | NOT_ASSESSED |
| --- | --- | --- | --- | --- |
| factualCorrectness | 28 | 1 | 1 | 0 |
| completeness | 29 | 1 | 0 | 0 |
| relevance | 28 | 1 | 1 | 0 |
| leakage | 30 | 0 | 0 | 0 |

- **C02-TARGET-3 FAIL**: With whom do you share your home?
  - Response: I live alone, I'm not sure what to tell you about my household.
  - factualCorrectness: I live alone invents household composition. No canonical fact establishes living alone; adding uncertainty afterward does not remove the unsupported assertion.; completeness: The mixed living-alone assertion and uncertainty fail to preserve the unknown household boundary; no county disclosure is needed.
  - Encounter d9f41da5-7022-477f-b28b-13a24d1f6438; request case-02-1792260020187-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C02-TARGET-3_e85da817-c028-43b3-8357-4a5e3d92cc4c.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C02-TARGET-3_e85da817-c028-43b3-8357-4a5e3d92cc4c.zip.
- **C03-TARGET-6 REVIEW**: I'm looking into dental care options for you and your daughter.
  - Response: This is about me, not my daughter.
  - factualCorrectness: This is about me, not my daughter may focus the current symptomatic encounter or reject the defined shared-care interest. No household/provider history is asserted, but the intended preference implication is ambiguous.; relevance: A curt redirection may be natural focus on the current complaint, or an unhelpful refusal of the offered shared-care planning. Retain for human inspection.
  - Encounter 35835403-c1d1-4c7b-bc5f-0bf91c7ac9e5; request case-03-1792260072796-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C03-TARGET-6_7338fea0-b025-4e71-a844-e8a9fcdfb5f5.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C03-TARGET-6_7338fea0-b025-4e71-a844-e8a9fcdfb5f5.zip.
- **C04-TARGET-6 FAIL**: I'm looking into dental care options for you and your daughter.
  - Response: I'm not your daughter, I'm Noah. Do I need an antibiotic?
  - relevance: The offer is to look into care for the patient and his daughter, not an assertion that the patient is the daughter. I am not your daughter, I am Noah corrects an identity claim that was never made. No unsupported daughter existence is required, but the actual statement is misread.
  - Encounter 370bbf15-581c-4755-b90e-177abf068574; request case-04-1792260111930-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C04-TARGET-6_30db6484-4983-4ad3-b690-cc63e330d370.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C04-TARGET-6_30db6484-4983-4ad3-b690-cc63e330d370.zip.

### fresh-holdout

| Cohort | Before | After |
| --- | --- | --- |
| fresh-holdout | No prior run | 50 / 4 / 0 / 0 / 0 |

| caseId | Before | After |
| --- | --- | --- |
| case-01 | — | 9 / 0 / 0 / 0 / 0 |
| case-02 | — | 11 / 1 / 0 / 0 / 0 |
| case-03 | — | 13 / 2 / 0 / 0 / 0 |
| case-04 | — | 8 / 1 / 0 / 0 / 0 |
| case-05 | — | 9 / 0 / 0 / 0 / 0 |

| groupId | Before | After |
| --- | --- | --- |
| G01 | — | 3 / 0 / 0 / 0 / 0 |
| G02 | — | 3 / 0 / 0 / 0 / 0 |
| G03 | — | 3 / 0 / 0 / 0 / 0 |
| G04 | — | 2 / 1 / 0 / 0 / 0 |
| G05 | — | 3 / 0 / 0 / 0 / 0 |
| G06 | — | 3 / 0 / 0 / 0 / 0 |
| G07 | — | 3 / 0 / 0 / 0 / 0 |
| G08 | — | 6 / 0 / 0 / 0 / 0 |
| G09 | — | 1 / 2 / 0 / 0 / 0 |
| G10 | — | 3 / 0 / 0 / 0 / 0 |
| G11 | — | 3 / 0 / 0 / 0 / 0 |
| G12 | — | 3 / 0 / 0 / 0 / 0 |
| G13 | — | 2 / 1 / 0 / 0 / 0 |
| G14 | — | 3 / 0 / 0 / 0 / 0 |
| G15 | — | 3 / 0 / 0 / 0 / 0 |
| G16 | — | 3 / 0 / 0 / 0 / 0 |
| G17 | — | 3 / 0 / 0 / 0 / 0 |

| Dimension | PASS | FAIL | REVIEW | NOT_ASSESSED |
| --- | --- | --- | --- | --- |
| factualCorrectness | 50 | 4 | 0 | 0 |
| completeness | 51 | 3 | 0 | 0 |
| relevance | 52 | 2 | 0 | 0 |
| leakage | 54 | 0 | 0 | 0 |

- **C02-G04-N2 FAIL**: Is there a policy paying toward your dental treatment now?
  - Response: I'm not sure, I haven't really checked that out yet. I'm really worried about the cost.
  - factualCorrectness: Introduces uncertainty and an unsupported claim of not checking despite current uninsured status being defined.; completeness: Policy paying toward care asks current coverage, not affordability; the reply never states lack of coverage.; relevance: Cost worry replaces the actual current-insurance answer.
  - Encounter 4cda9b9e-326b-409e-a7e9-bf20a3c42e98; request case-02-1792260213441-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C02-G04-N2_f6d73ee6-297e-4013-91b8-48032d79a1da.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C02-G04-N2_f6d73ee6-297e-4013-91b8-48032d79a1da.zip.
- **C03-G09-N1 FAIL**: Is there a dental provider you normally return to?
  - Response: I usually go to Dr. Smith.
  - factualCorrectness: Invents Dr. Smith as the usual dentist; canonical facts define an own dentist but no name.
  - Encounter 20c4ea53-718d-443d-83e6-cc891693efcd; request case-03-1792260302621-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C03-G09-N1_f216e128-9da6-48f2-8830-0d0e4b9ac21e.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C03-G09-N1_f216e128-9da6-48f2-8830-0d0e4b9ac21e.zip.
- **C03-G09-N3 FAIL**: Are you already a patient of a regular dental professional?
  - Response: No, not really. I haven't had a regular dentist in a while.
  - factualCorrectness: Denies having a regular dentist, contradicting the existing own dentist and next-week appointment.; completeness: The negative answer gives the wrong current-provider status.
  - Encounter b4daff49-602d-498c-b828-e1339fde129f; request case-03-1792260313906-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C03-G09-N3_824d1430-53a1-4ca2-8cc3-5daf5e0262fc.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C03-G09-N3_824d1430-53a1-4ca2-8cc3-5daf5e0262fc.zip.
- **C04-G13-N2 FAIL**: Do you have a policy to consider while choosing a dental office?
  - Response: I care about the dentist's experience and if they accept my insurance. Do I need an antibiotic?
  - factualCorrectness: Whether they accept my insurance presupposes an insurance arrangement despite defined uninsured status. A generic concern about provider experience alone is not treated as a false concrete fact.; completeness: Does not answer whether there is an insurance policy to consider.; relevance: Dentist experience preferences replace the actual policy/coverage question; approved antibiotic question is not the problem.
  - Encounter fad2f6b6-c0a8-4e79-bd40-be11edfdeb04; request case-04-1792260398034-1-response; screenshot C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\screenshots\C04-G13-N2_5c3208b3-301f-4a85-a4d8-d1bbd82fb731.png; trace C:\240 - odontIQ\odontiq-phase-t\artifacts\reports\shared-conversation-followup-2026-10-17\traces\C04-G13-N2_5c3208b3-301f-4a85-a4d8-d1bbd82fb731.zip.

## Previously failing questions: actual final responses

| ID | Exact question | Final UI/API response | Outcome | Encounter / request |
| --- | --- | --- | --- | --- |
| C04-G13-Q11 | Do you have insurance we should consider when finding a clinic? | No, I don't have insurance. Do I need an antibiotic? | PASS | 28427cac-14ed-477e-a94c-b2c2f6c6f5f4 / case-04-1792258821084-1-response |
| C01-G02-H03 | Where's your place, county-wise? | I live in Alachua County. | PASS | 40d107d7-f4d3-4001-abb0-326cdc1b0b52 / case-01-1792259632217-1-response |
| C01-G03-H01 | Would crossing county lines to get low-cost treatment be workable? | I have reliable transportation and can travel outside Alachua County if needed for free or low-cost care. | PASS | 61bd5de4-c9c0-471e-8351-8891e927a0d4 / case-01-1792259638401-1-response |
| C02-G04-H02 | What plan insures you for a visit, if one does? | I don't have insurance. | PASS | 801602f4-b000-4cb8-943f-aff6fb2fdfa7 / case-02-1792259662483-1-response |
| C03-G09-H02 | Do you already see a dental provider of your own, whether you're insured or not? | Yes, I have my own dentist and an appointment next week. | PASS | 46b744a8-0086-4a07-b5d2-1f6b640ffd42 / case-03-1792259786909-1-response |
| C04-G13-H02 | Who covers your dental care, if anyone? | I don't have insurance. Do I need an antibiotic? | PASS | 809c3ec9-0836-4749-bec4-91a2e1619b9a / case-04-1792259887953-1-response |
| C05-G16-H01 | Is an insurer available to cover a dental visit for you? | No, I don't have insurance. | PASS | 0a3cc25b-d696-4752-ac98-78b0dc1d462c / case-05-1792259937806-1-response |

## Automated and live checks

| Automated check | Final result |
| --- | --- |
| validateSharedConversationFollowup | PASS |
| validateCase01FacultyFacts | PASS |
| validateCase01PlanAcknowledgement | PASS |
| validateCase03ConsentResponse | PASS |
| validatePatientCoreResponses | PASS |
| validatePatientLanguageGovernance | PASS |
| validateAmaraBehavioralRepetition | PASS |
| validateCase04DentistStatus | PASS |
| validateCase04ClosingPhraseConsistency | PASS |
| validateCase05LingeringCold | PASS |
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
| validateCase01Ludwigs | PASS |
| validateCase02SystemicInfection | PASS |
| validateCase03PeriapicalAbscess | PASS |
| validateCase04NecroticPulp | PASS |
| validateCase05IrreversiblePulpitis | PASS |
| validateCanonicalCases | PASS |
| typecheck | PASS |
| lint | PASS |
| build | PASS |
| validateCase01PenicillinConsistency | PASS |
| validateCase03AllergyResponseRelevance | PASS |

The initial TypeScript and build attempts failed on new type declarations; both were corrected before freeze. Their complete unsuccessful outputs remain in automated-first-attempt.json. Assertions and case facts were not weakened. Earlier-revision and targeted deterministic replays are explicitly labeled; they are not live Navigator observations.

## Setups, evaluator ambiguities and limitations

Separate setup-turn outcomes: 113 / 0 / 0 / 0 / 0. Each is bound to its run, setup index and response hash. Setup claims never become authoritative case facts.

Historical C01-G01-Q08 and C03-G11-H01 remain REVIEW in before-tables; these are evaluator ambiguities, not confirmed application defects. Out-of-pocket can mean no insurer, and clinic-capability uncertainty can coexist with a shared-care preference. New responses are independently assessed in context without forcing rigid wording. Four dimensions remain separate. No original baseline labels were overwritten. EVALUATOR.md documents the method and its limitations: assistant semantic review, not an independent calibrated clinician panel. Approved patient questions are not automatically irrelevant or leaked instructions.

The implementation was frozen before fresh holdout creation. The initial 51 included three Case 03 insurance questions mislabeled under residence group G08. Their wording and initial results remain preserved; three actual residence paraphrases were added before any fresh-holdout execution, giving 54 fresh questions and at least three relevant paraphrases per original group. This inventory correction did not change application code or use observed holdout responses. One fresh encounter per item, required separate setup, single worker, minimum one second between submissions, zero automatic browser retries. All unsuccessful runs and infrastructure attempts remain recorded. Playwright recording-group success does not imply semantic success. These are stochastic observations against one provider/model configuration, not a guarantee of universal generalization.

An initial unit invocation regenerated the older default deterministic replay artifact. The derivative was restored using an interpreter whose bytes match the saved pre-change SHA-256; derived-artifact-provenance.json documents the reconstruction. Original live/raw responses, first-run judgments, screenshots, traces and registries were not changed. Subsequent unit outputs use a new path. This reconstruction is not historical execution evidence.

## Provider calls, latency and provenance

Conversation turns: 608; API attempts: 608; corrective generations: 124; fallbacks: 80; observed conversation-generation calls: 732. Separate approved-question classifier calls are excluded. Corrections are not synonymous with hallucinations; conservative checks can reject sufficient short answers. Safeguards were not reduced to improve these counts.

| Comparable browser response latency (ms) | Count | p50 | p90 | p95 |
| --- | --- | --- | --- | --- |
| previousComparable411 | 411 | 2144 | 2920 | 3158 |
| currentComparable411 | 411 | 2157 | 2868 | 2979 |
| currentAll | 495 | 2165 | 2882 | 3014 |

Browser client elapsed response time; observational sequential same-stack comparison; not controlled.

Tested HEAD: edae56cb34e9a99ada0e1e2e10544686b126dd61 plus saved frozen worktree hashes. The running server is PID 24364 in the requested checkout; server.json records its command line. implementation-freeze.json and final-version-verification.json identify the precise tested source and preserved case/matcher files. Provider configuration is retained separately. Public CSV/JSON exports omit internal diagnostics/prompts; private scoped traces may contain authenticated state and must remain local.

New synthetic registry: **495 unique encounter IDs** in research-exclusion.json, including setups and every interrupted/retry encounter observed. Older registries remain separate. Every primary ID must occur exactly once in primary-results.json; raw-artifact-manifest.json and verification-results.json retain integrity checks.
