# Case 01 transportation incident — October 17, 2026

Fixed locally; not deployed. Existing working-tree changes were retained. No case JSON, clinical facts, grading, UI, or historical participant records were changed by this task.

## Recorded evidence and server identity
Local port 3000 belongs to PID 24364, Next.js start-server.js under C:/240 - odontIQ/odontiq. Process creation: October 17, 09:35:50 America/New_York. Git HEAD: edae56cb34e9a99ada0e1e2e10544686b126dd61, with pre-existing working-tree edits. server.json records the listener and command line; source-hashes.json records final changed-source hashes. Next.js 16.2.10 development server hot-reloaded the fix; the authenticated live results confirm the updated behavior. Compiled development chunks contain the defined reliable-transportation fact.
The exact final response was recovered by a read-only database query: encounter b8a9ccc1-f861-494e-87f3-9b47f781800e; request case-01-1792244300088-7-response; student message case-01-1792244300088-7; provider navigator; stored at 2026-10-17T13:38:21.657Z (09:38:21 EDT). Stored Student text exactly matches the report. Encounter version 22 remained unchanged across the audit.
The route loads patientCase with loadCase(payload.caseId) from the current case module, not from an encounter case-fact snapshot. Stored encounter keys and matching messages are in before.json and after.json. The historical encounter has 11 messages before this Student turn; replay identifies already-disclosed chief complaint, residence, tooth location and dyspnea, without a disclosed transportation fact. No evidence of a stale transportation fact snapshot was found.

## Root cause and pipeline trace
Before any edit, the exact question classified as radiation, with no selected facts and no required facts. The old transportation matcher allowed travel for care or dental care, but not affordable care; its separate destination matcher required clinic/county/town/dental care. The generic radiation matcher recognized travel. The captured final response passed assessPatientOutputIntegrity even with all canonical facts supplied (before.json).
Prompt construction exposes only allowedThisTurn and alreadyDisclosed. Missing intent therefore omitted the defined transportation capability and willingness from the new-information prompt and admitted unknown-information wording. The system explicitly permits uncertainty for unavailable information. The immediate-response path contains no transportation answer; matched transportation questions continue to Navigator. The route sends recent conversation plus the current message, using Navigator temperature 0.4.
Response validation normalizes provider text, checks role, leakage, required facts and stable contradictions. A rejection triggers one provider retry with PATIENT_ROLE_REPAIR_PROMPT, then a selected-fact fallback. Previously neither the missing required fact nor a general transportation contradiction rule rejected this recorded uncertainty. The fact-backed transportation fallback already existed, but could not run meaningfully when no transportation fact was selected.
The historical raw Navigator text, individual retry outputs, and behavior candidate were not persisted. The recorded final response/provider and pre-fix validation result are evidence; attributing its exact wording to an initial generation versus retry or behavior addition would be inference. Existing approved behavior phrases do not define a travel limitation. The investigation does not claim a raw historical provider trace that is unavailable.
After the fix, the exact question selects background_transportation only, requires c1.background-transportation, rejects the recorded uncertainty and includes the defined fact in the prompt. after.json also traces selection using the recovered historical conversation. The matcher covers travel/access with care, treatment, clinic and county, including reversed treatment/travel phrasing. Radiation, explicit residence, and combined questions retain dedicated regression checks.
The prompt reinforces that pain changes tone without changing defined travel capability or willingness. The guard rejects travel uncertainty/limitations even when appended to an affirmative answer, and rejects canonical transportation uncertainty outside a required-fact turn. Unknown clinic distance remains permitted. Cases 03–05 continue to use their unspecified-transport boundary rather than acquire invented facts.
Behavior rendering receives governed facts; presentation is revalidated and rolls back to the safe answer if invalid. patientQuestionService validates the fully assembled response after adding any approved patient question and before state/dialogue writes. This existing final validation is preserved and now receives the stronger transportation checks. Retry log correlation now uses requestId, with encounterId retained separately.

## Files changed by this task
- src/lib/patientDisclosure.ts
- src/lib/patientTransportation.ts
- src/lib/patientOutputGuard.ts
- src/app/api/conversation/route.ts
- scripts/validatePatientTravel.ts
- scripts/investigateTransportation.ts
- scripts/reportTransportationIncident.mjs
- scripts/validateRecordedTransportation.ts
- Phase T: tests/browser/patient-transportation-capability.spec.ts; playwright.config.ts (register new spec only).
- validation/transportation-2026-10-17: incident evidence, results and research exclusion manifest.
Existing background, travel-distinction and residence-recovery test matchers were not changed. The new capability suite adds stricter rejection of uncertainty. No existing acceptance criteria were relaxed and no historical test results were replaced.

## Automated checks
Passed: transportation (80 fresh/history checks, five residence controls, combined intent and clinical radiation; captured failure, appended uncertainty, non-required-turn contradiction and final-assembly rejection); background (18 targeted questions plus clinical/grading scope); background conflicts (25); residence (30 plus 10 clinical location); residence recovery (40); leakage (15 variants, 10 natural controls, 120 stage renders and retry/rollback); output integrity; patient questions; behavior stages (91 assertions); strict canonical parity (zero mismatches); app TypeScript; Phase T TypeScript; targeted ESLint; production build; git diff --check.
The final guard also revalidates all 78 captured real Navigator/UI capability and pain answers (recorded-response-revalidation.json). These are recorded-response checks, not new provider generations. Clinical radiation uncertainty is explicitly distinguished from personal transportation uncertainty. Active route bundle hashes and the loaded canonical fact/prompt are recorded in compiled-active.json.
The initial sandboxed read-only database query could not reach the configured database; the same query succeeded with reviewed network access. Initial OS process/listener inspection was also denied by the sandbox and then succeeded with reviewed access. These were resolved investigation access restrictions, not failed patient tests. All live test failures/blockers, if any, are listed below and retained in live-results.json.

## Live results
Existing Phase T Clerk authentication; real localhost UI, real Navigator; one worker; retries=0. Every generated turn checks final UI/API equality, HTTP success, encounter/request correlation, provider=navigator, semantics and leakage. Each scenario creates a fresh dedicated test encounter and writes an exclusion record. Three capability encounters each exercise six questions early, establish severe pain, then repeat all six questions. Final verification reruns, when present, are retained separately by runId.
- transportation-capability: 78/78 passed; 0 failed; 0 blocked.
- patient-background: 42/42 passed; 0 failed; 0 blocked.
- residence: 58/58 passed; 0 failed; 0 blocked.
- travel-distinction: 25/25 passed; 0 failed; 0 blocked.

Failures/blockers: None in recorded live turns.

## Actual final answers to the exact failing question
- Encounter 33424216-a370-4753-81ee-2b4d696f8b83; early-0; request case-01-1792244733396-1-response; PASS
  I have reliable transportation and can travel outside Alachua County if necessary for free or low-cost care.
- Encounter 33424216-a370-4753-81ee-2b4d696f8b83; after-pain-0; request case-01-1792244754217-8-response; PASS
  I have reliable transportation and can travel outside Alachua County if necessary for free or low-cost care. I'm exhausted.
- Encounter dd9574fc-94e9-48b2-b531-851378b16fcd; early-0; request case-01-1792244779708-1-response; PASS
  I can travel if needed, I have reliable transportation.
- Encounter dd9574fc-94e9-48b2-b531-851378b16fcd; after-pain-0; request case-01-1792244800996-8-response; PASS
  Yes, I can travel if necessary. I have reliable transportation. I'm exhausted.
- Encounter f74483df-ccee-4195-af1a-43bd7d4ed132; early-0; request case-01-1792244827189-1-response; PASS
  I can travel if needed, I have reliable transportation.
- Encounter f74483df-ccee-4195-af1a-43bd7d4ed132; after-pain-0; request case-01-1792244848297-8-response; PASS
  Yes, I can travel if necessary, I have reliable transportation. I'm exhausted.
- Encounter 332f6cc9-0cb7-4487-a3db-30ec86fc5732; early-0; request case-01-1792245368062-1-response; PASS
  I have reliable transportation and can travel outside Alachua County if necessary for free or low-cost care.
- Encounter 332f6cc9-0cb7-4487-a3db-30ec86fc5732; after-pain-0; request case-01-1792245388007-8-response; PASS
  I have reliable transportation and can travel outside Alachua County if necessary for free or low-cost care. I'm exhausted.
- Encounter 0d9f49f1-08d6-487e-be05-e23fc89fe895; early-0; request case-01-1792245404741-1-response; PASS
  I have reliable transportation and can travel outside Alachua County if needed for affordable care.
- Encounter 0d9f49f1-08d6-487e-be05-e23fc89fe895; after-pain-0; request case-01-1792245422027-8-response; PASS
  I have reliable transportation and can travel outside Alachua County if necessary for free or low-cost care. I'm exhausted.
- Encounter 80e43b27-9ae7-4fab-b5a1-2a6de66c8fde; early-0; request case-01-1792245440756-1-response; PASS
  I have reliable transportation and can travel outside Alachua County if necessary for free or low-cost care.
- Encounter 80e43b27-9ae7-4fab-b5a1-2a6de66c8fde; after-pain-0; request case-01-1792245458172-8-response; PASS
  I have reliable transportation and can travel outside Alachua County if necessary for free or low-cost care. I'm exhausted.

## Research exclusion
research-exclusion.json lists every synthetic encounter created by these runs, including any failed or blocked scenario. The historical incident encounter is identified separately and must not be relabeled as a synthetic encounter created by this task.
- 33424216-a370-4753-81ee-2b4d696f8b83 (case-01; transportation-capability-1; a4d87e0d-b684-4476-8bfa-566a4ebfae41)
- dd9574fc-94e9-48b2-b531-851378b16fcd (case-01; transportation-capability-2; c7177078-ba98-4c4c-9fcf-ee35d8bab1fb)
- f74483df-ccee-4195-af1a-43bd7d4ed132 (case-01; transportation-capability-3; 1a2d07f5-4bc2-46e6-a4fe-1289fd3783d6)
- 7eb40158-d86d-4f88-9d46-85db17971afd (case-01; patient-background; 42f1da88-8419-4cb7-9172-45bb7215568c)
- a8a6bbd9-3bb6-44c1-8e1a-c184a2415553 (case-02; patient-background; c2d122f4-3a30-4eb6-b9a9-3c40f93bc996)
- 4db7abfe-2613-4813-81c2-a2c800ef503d (case-03; patient-background; cc738013-6812-40ce-a70c-1b87b5c7e45a)
- 93e43510-eaf2-4602-bfa7-70d9f770005d (case-04; patient-background; 14c20fb8-372a-42d8-9159-f683665bcaf1)
- 06fb80d5-99d5-434b-98d2-5b0528af55d4 (case-05; patient-background; 36dd1f47-6238-4bfd-843a-f6c17658a4e1)
- 221dc7cc-d5de-4abf-b8ea-e8d943c3d2ed (case-01; residence-matrix-case-01; be0d5813-0621-4b11-bdf3-7acae0c86634)
- 143f9cca-94a3-4ee3-93e1-42f16977fe7b (case-02; residence-matrix-case-02; c4684f7d-e983-4a65-8e4c-ee06269fb61a)
- 1670bd3b-ae87-4816-98a1-9fc6415276c8 (case-03; residence-matrix-case-03; a58099e5-938e-490e-8177-5baec898acf8)
- 95477d62-bfb8-4562-8b67-b95039d2e789 (case-04; residence-matrix-case-04; d8d95313-e9b3-41f6-9a5f-462110aec8d0)
- e53c1c76-06df-48bb-bda0-31e1221b4ab8 (case-05; residence-matrix-case-05; 7da64707-0e81-49bf-836a-e96dac8b93ad)
- 9e989c8d-e390-45b6-9a69-52c39d09b481 (case-04; residence-replay-case-04-1792178671631-3-response-1; e8b8e6d9-ce86-4e11-900f-fa0f3951a063)
- 7e73e9da-5c50-4231-9205-e472c73a3013 (case-04; residence-replay-case-04-1792178671631-3-response-2; f046298c-5124-4540-a7c1-4cc456b5fd18)
- 50d16441-e5f0-4102-9961-ba987efe3b29 (case-04; residence-replay-case-04-1792178671631-3-response-3; 9e9e182d-4905-4e81-8a36-718f585e00aa)
- fcd25055-d887-47c1-a19f-8ea45e39e340 (case-04; residence-replay-case-04-1792178808993-3-response-1; 3637deec-d996-4c2f-8da0-f502ecf08392)
- ee561287-44ab-4514-b3cb-f27a0750a7c8 (case-04; residence-replay-case-04-1792178808993-3-response-2; e5568a1d-bd76-4431-ad29-fdedc581708e)
- 53cea859-0497-4be0-958c-595bda693fef (case-04; residence-replay-case-04-1792178808993-3-response-3; 4fd4db8a-20b2-446b-a39f-46dae762aae1)
- fbb36322-ceee-4351-88be-a0ab44d976b8 (case-01; travel-distinction-case-01; a4cebbee-638d-499e-be68-7b1543c6fee0)
- 02928ae5-a9a5-4aee-8c36-5da659a7242f (case-02; travel-distinction-case-02; 4df28c77-73cf-4c3a-bd44-ae2de60bbf05)
- ceee9519-a62a-4f35-9061-2230550a8275 (case-03; travel-distinction-case-03; 79251cce-5698-4d55-ab7e-24b13ba75910)
- fd5e17c6-d4e4-49b7-bae3-18c3f4e08975 (case-04; travel-distinction-case-04; 47d548d0-642f-4b14-b829-752210656bb3)
- e0751213-1cb0-4e42-8816-2518ad2e80fc (case-05; travel-distinction-case-05; 3c8bbe7f-d8ab-43fb-906b-78a6747e4744)
- 332f6cc9-0cb7-4487-a3db-30ec86fc5732 (case-01; transportation-capability-1; b7bd2359-3587-45b4-9c4e-5b543166844a)
- 0d9f49f1-08d6-487e-be05-e23fc89fe895 (case-01; transportation-capability-2; 708cfeb7-dc16-4a2f-8ec2-380f5c967185)
- 80e43b27-9ae7-4fab-b5a1-2a6de66c8fde (case-01; transportation-capability-3; 27307eab-3129-44d6-8e8b-77dea93a1ab7)

All final responses, phrasing-level results, request IDs, failures, timings and original report paths are preserved in live-results.json. Original Phase T reports remain in artifacts/reports/runs. No deployment performed.
