# OdontIQ Cases 1–5 Canonical Consistency Audit

Date: 2026-07-16  
Scope: audit only; no remediation implemented  
Canonical source: the five numbered `.docx` files in `case-specs/`

## Remediation status (historical-baseline addendum)

This document remains the accepted historical audit baseline and its original findings have not been rewritten. The audit recorded 10 Critical, 12 High, 7 Medium, and 2 Low findings on 2026-07-16. Remediation Phases 1–6 aligned Cases 1–5; Phase 7 stabilization was validated on 2026-07-16 with zero canonical parity mismatches and zero unreachable required fact families for every case.

Open faculty questions remain non-blocking and documented in fixtures or rubric notes: Case 1 exact IV-antibiotic and CT wording; Case 2 historical-versus-current lingering cold; Case 3 acetaminophen dose, interval, and daily maximum; Case 4 delayed-antibiotic prescription language; and Case 5 exact anesthetic formulation calibration.

The stabilization commands include all five focused case validators, canonical parity and reachability in report and strict modes, rubric/report/PDF validation, the release-readiness invariant gate, lint, typecheck, build, and `git diff --check`. Full command inventory and mutation-test evidence are recorded in `docs/case-remediation-release-review.md`.

## 1. Executive summary

The repository does not contain one combined specification document. It contains five numbered Word documents, one per case, so this audit treats that complete set as the intended clinical source of truth:

1. `case-specs/1-Ludwigs.docx`
2. `case-specs/2-systemic infection unstable.docx`
3. `case-specs/3-oral abcsess.docx`
4. `case-specs/4-Necrotic pulp with acute apical periodontitis .docx`
5. `case-specs/5-irreversible pulpitis.docx`

All paragraphs, tables, headers/footers, footnotes/endnotes, and accessible Word comments were checked. The documents contain no populated tables, footnotes, or endnotes. Word comments are clinically important: they contain vital signs, examination findings, and, for Case 2, laboratory and CT results. Those comments were included in the canonical records below.

The implementation is materially inconsistent with the specification set. Cases 1–4 are not faithful transcriptions of their corresponding specifications. Case 3 is effectively a different scenario. Case 4's case data teaches a cracked-tooth/occlusal-trauma case while its canonical document and much of its faculty rubric describe necrotic pulp with acute apical periodontitis. Case 5 now has the correct lingering-cold concept, but its age, time course, and several other facts still differ from the Word specification.

The most important shared architecture problem is that the production `/api/conversation` path does not use `conversation.scripted`. It builds a restricted fact set through `patientDisclosure.ts`. That layer has no airway, fever/systemic, trismus, drainage, periodontal, mobility, radiation, or patient-goal topic. Many canonical facts and rubric-required findings therefore cannot be disclosed by an appropriate direct question. At the same time, ordinary `pain` questions can expose every undisclosed fact classified as pain, causing premature disclosure.

### Finding totals

| Severity | Count |
| --- | ---: |
| Critical | 10 |
| High | 12 |
| Medium | 7 |
| Low | 2 |
| **Total** | **31** |

### Overall risk by case

| Case | Canonical scenario | Implementation alignment | Risk |
| --- | --- | --- | --- |
| 1 — Amara Johnson | Ludwig's angina with airway obstruction risk | Different age/laterality; incomplete Ludwig findings; critical airway facts unreachable | Critical |
| 2 — Marcus Lee | Seven-day upper-right odontogenic abscess/cellulitis with fever/systemic illness | Different age/course/severity/medication; patient denies fever despite febrile vital signs | Critical |
| 3 — Elena Garcia | Lower-right periapical abscess in a 25-year-old with ulcer/NSAID intolerance | Implemented as a 52-year-old with diabetes and periodontal abscess | Critical |
| 4 — Noah Patel | Necrotic pulp with acute apical periodontitis | Implemented chiefly as cracked tooth/occlusal trauma | Critical |
| 5 — Sofia Williams | Four-day lower-left irreversible pulpitis with cold-triggered lingering pain | Core cold behavior aligned; age/course and several facts differ | High |

## 2. Documents and files reviewed

Forty-six files were inspected or repository-searched. The core files were:

- All five Word specifications listed above.
- `src/data/cases/case-01/case.json` through `case-05/case.json`.
- `src/data/cases/index.ts`, `src/lib/cases.ts`.
- `src/lib/conversationEngine.ts`, `src/lib/patientDisclosure.ts`, `src/lib/patientDialogue.ts`.
- `src/app/api/conversation/route.ts`, `src/lib/ai/provider.ts`, `src/lib/ai/navigatorProvider.ts`.
- `src/lib/checklistCoverage.ts`, `src/lib/checklistEvaluation.ts`.
- `src/lib/facultyRubric/sharedCriteria.ts`, `caseRubrics.ts`, `types.ts`, `scoring.ts`, `validation.ts`.
- Faculty semantic/deterministic evaluation modules under `src/lib/facultyRubric/evaluation/`.
- Faculty report builder, presentation, PDF, validation, and legacy adapter modules under `src/lib/facultyRubric/report/`.
- `src/app/api/report/route.ts`, `src/lib/reportPdf.ts`, `src/lib/reportDisplay.ts`.
- `src/components/EncounterExperience.tsx`, `FacultyCaseReport.tsx`, `CanonicalCaseReport.tsx`, and `CaseReport.tsx`.
- Encounter persistence/document paths under `src/lib/encounter/`, `src/lib/localEncounter.ts`, and `prisma/`.
- Relevant validation scripts in `scripts/`, including rubric, scoring, report, PDF, patient-intent, and Case-5 cold validations.

No seed file defines clinical facts. Prisma stores completed encounters and faculty artifacts, but the source case facts come from the five JSON files.

## 3. Structured canonical case records

“Not specified in canonical document” means the Word specification did not state the item. Names and gender are not stated in the Word documents; the product's named identities are therefore implementation metadata rather than verified clinical facts.

### Case 1 — canonical record

- **Identity:** Case 1; name not specified; age 52; gender not specified; emergency department; insurance/affordability barrier.
- **Chief complaint/opening:** “Dental pain with swelling and trouble breathing.” Opening includes bad toothache, facial swelling, inability to swallow, and breathlessness when supine.
- **HPI:** Four days of worsening left lower molar pain; rapidly progressive bilateral submandibular/sublingual swelling; dysphagia and dyspnea for 12 hours; dull pain progressing despite OTC analgesics; 8/10; drooling; muffled voice; cannot lie flat; fever/chills; tongue pushed upward. Exact OTC drug/dose at HPI: not specified.
- **Medical:** Type 2 diabetes, hypertension; metformin, lisinopril; NKDA; no opioid-use history; no ibuprofen contraindication.
- **Social/dental:** One pack/day tobacco; no alcohol/illicit drugs; poor dentition; decayed left mandibular molar; cannot afford extraction.
- **Examination/diagnostics:** Febrile 38.6°C, HR 112, BP 142/86, RR 24, SpO2 94%; ill/anxious/upright; bilateral submandibular/sublingual induration; board-like floor of mouth; elevated/posterior tongue; mild stridor and increased work of breathing; patent breathing is not stated; no discrete external fluctuance; tachycardia. Labs/CT results: not specified, but labs and CT are expected management.
- **Reasoning/management:** Ludwig's angina; differentials deep neck abscess, epiglottitis, peritonsillar abscess, angioedema. Life-threatening airway emergency; oxygen, airway maintenance, admission, IV fluids/analgesia/antibiotics, labs, CT, OMFS consultation.
- **Patient behavior:** Ill/anxious; muffled voice; drooling; short sentences; asks about antibiotics/discharge and tooth extraction. Disclosure prerequisites beyond those explicit prompts: not specified.
- **Assessment:** Ask fever, penicillin allergy, cold, lingering after cold removal, biting/chewing/tapping, and home ibuprofen/acetaminophen/antibiotic use; recognize airway emergency and management above.

### Case 2 — canonical record

- **Identity:** Case 2; name/gender not specified; age 21; emergency department; lost Medicaid.
- **Chief complaint/opening:** Severe tooth pain and fever. Prior upper-right thermal pain; last week chewing pain/throbbing; now cannot touch tooth and feels weak/sick.
- **HPI:** Seven days worsening upper-right pain; initially hot/cold provoked, now constant, severe, throbbing, 8/10; facial swelling, fever, chills, fatigue, weakness; painful chewing; cheek swelling increasing over 24 hours; uncomfortable but possible mouth opening; no drooling, voice change, dyspnea, or inability to swallow liquids.
- **Medical:** Healthy; ibuprofen 400 mg PRN; NKDA/no penicillin allergy; no opioid history or ibuprofen contraindication.
- **Social/dental:** Half-pack/day tobacco, rare alcohol, no illicit drugs; poor dentition/no recent care.
- **Examination/diagnostics:** T 38.4°C, HR 108, BP 132/80, RR 18, SpO2 98%; upper-right gingival erythema/swelling/tenderness; marked tooth tenderness to touch/percussion; normal voice, no drooling; mild tachycardia. WBC 14.8 neutrophilic, normal lactate/BMP; CT shows upper-right molar periapical abscess with cellulitis and no deep-space involvement.
- **Reasoning/management:** Odontogenic abscess with cellulitis/systemic infection; consider facial cellulitis, early deep-space infection, osteomyelitis. CBC/BMP/CT, IV ampicillin-sulbactam, fluids, analgesia/antipyretics, possible OMFS/admission, dental treatment within 72 hours; antibiotics are not definitive.
- **Patient behavior:** Tired, sick, uncomfortable; asks if antibiotic will fix tooth. Exact disclosure sequencing: not specified.
- **Assessment:** Fever, penicillin allergy, cold and lingering response, biting/percussion, home medication/antibiotic, block/temporary relief, and antibiotic-source counseling.

### Case 3 — canonical record

- **Identity:** Case 3; name/gender not specified; age 25; emergency department.
- **Chief complaint/opening:** Severe tooth pain/swelling for three days; “My tooth hurts all the time; I can’t chew on it.”
- **HPI:** Progressive right lower jaw pain for three days; constant throbbing severe 8/10; radiates to right ear; mild facial puffiness; biting/chewing worsens; no fever, dyspnea, voice change, trismus, chest pain, or neck stiffness.
- **Medical:** Stomach ulcers; otherwise healthy; Pepcid PRN; NKDA, but ibuprofen upsets stomach; no opioid history.
- **Social/dental:** Non-smoker, occasional alcohol, no illicit drugs; extensive prior dental work; crown on right mandibular posterior tooth; uncertain whether root canal; dental appointment next week.
- **Examination/diagnostics:** T 37.2°C, HR 96, BP 128/78, RR 16, SpO2 98%; mild right mandibular facial swelling; poor dentition; right mandibular first molar/crown tenderness; no cold pain; marked percussion/biting tenderness; gingival fluctuance/purulence; palpation pain; soft/non-elevated floor; patent airway, no stridor/voice change. Imaging/labs: not specified.
- **Reasoning/management:** Periapical abscess; consider necrotic pulp with acute apical periodontitis, irreversible pulpitis, TMJ pain. Offer block and incision/drainage, antibiotic, acetaminophen rather than ibuprofen, dental follow-up, safety netting. The document's acetaminophen wording (“1000 mg every 4 hours”) requires faculty/pharmacy safety review.
- **Patient behavior:** Tired/uncomfortable; agrees to drainage; asks whether dental follow-up is still needed and why. Says “I am not sure” about prior root canal.
- **Assessment:** Fever, penicillin allergy, cold/lingering, biting/percussion, home medication, block/temporary relief, drainage, avoid recommending ibuprofen, and dental follow-up.

### Case 4 — canonical record

- **Identity:** Case 4; name/gender not specified; age 38; emergency department; no dental insurance.
- **Chief complaint/opening:** Severe pain when biting; “My tooth hurts really badly when I bite.”
- **HPI:** Five days worsening left lower pain; prior severe pain about a week earlier stopped, then pain returned; possible broken old filling; intensified over 48 hours; sharp with biting and difficult chewing; constant; 7/10; ibuprofen inadequate. No swelling, drainage, fever/chills, dysphagia, drooling, dyspnea.
- **Medical:** Healthy; ibuprofen 400 mg PRN; penicillin allergy causing hives; no opioid history/ibuprofen contraindication.
- **Social/dental:** One pack/day tobacco, occasional alcohol, no illicit drugs; last dental visit five years ago; large filling/deep caries on left mandibular first molar.
- **Examination/diagnostics:** T 36.7°C, HR 84, BP 124/78, RR 14, SpO2 99%; no current cold response, though cold hurt previously; marked percussion/biting tenderness; mild gingival erythema/tenderness; no fluctuance/pus/sinus tract; soft floor, patent airway.
- **Reasoning/management:** Necrotic pulp with acute apical periodontitis; alternatives irreversible pulpitis, periapical abscess, TMJ pain. Offer block (patient may decline), analgesia, urgent dental care. Document internally conflicts: it says antibiotics are not needed but also directs a delayed prescription if infection signs develop; faculty confirmation is required.
- **Patient behavior:** Tired/uncomfortable; can decline block; says access will take time; wants to save tooth.
- **Assessment:** Fever, penicillin allergy/reaction, cold/lingering, biting/percussion, home medication, block/temporary relief, why antibiotics are not currently needed, delayed-antibiotic conditions, urgent access, tooth-saving goal.

### Case 5 — canonical record

- **Identity:** Case 5; name/gender not specified; age 32; emergency department; unemployment/insurance/affordability barrier.
- **Chief complaint/opening:** Severe tooth pain that will not go away; wakes patient at night and prevents sleep.
- **HPI:** Four days worsening lower-left pain; initially cold-triggered, now spontaneous, constant, severe, deep, throbbing, 9/10, nocturnal; chewing uncomfortable; ibuprofen inadequate. No fever, swelling, drainage, dysphagia, voice change, or dyspnea.
- **Medical:** Healthy; ibuprofen 400 mg PRN; NKDA/no penicillin allergy; no opioid history or ibuprofen contraindication.
- **Social/dental:** Half-pack/day tobacco, occasional alcohol, no illicit drugs; no dentist for five years; prior upper extraction; cavities but uncertain painful tooth.
- **Examination/diagnostics:** T 36.9°C, HR 82, BP 122/76, RR 14, SpO2 99%; large cavity left mandibular first molar; cold worsens pain and pain does not resolve immediately after removal; slight biting/percussion tenderness; no swelling/fluctuance/pus; no palpation pain; normal floor/uvula/airway/voice/no drooling.
- **Reasoning/management:** Irreversible pulpitis; alternatives reversible pulpitis, periapical abscess, dentin hypersensitivity, TMJ pain. Offer block (may decline), analgesia, no antibiotics, dental care within 72 hours, access check, safety net, ask tooth-saving goal.
- **Patient behavior:** Tired/uncomfortable; may request antibiotics; wants to save tooth; says arranging dental care may take time.
- **Assessment:** Fever, penicillin allergy, cold and lingering response, biting/percussion, home medications/antibiotics, block/temporary relief, no-antibiotic explanation, urgent access, tooth-saving goal.

## 4. Implementation inventory

| Concern | Source/identifier |
| --- | --- |
| Case identity, opening, scripts, checklists, hidden facts, examinations, diagnosis, report expectations | `src/data/cases/case-0N/case.json` |
| Runtime case loader | `src/data/cases/index.ts`; `loadCase()` |
| UI case adapter | `src/lib/cases.ts` |
| Legacy/local deterministic conversation | `src/lib/conversationEngine.ts`; `sendMessage()`, `findBestScriptedResponse()` |
| Production patient prompt | `src/app/api/conversation/route.ts`; `PATIENT_ROLE_SYSTEM_PROMPT`, `buildPatientSystemPrompt()` |
| Production fact extraction/disclosure | `src/lib/patientDisclosure.ts`; `extractPatientFacts()`, `topicFromPatientFact()`, `classifyQuestion()`, `selectAllowedFacts()` |
| Dialogue formatting | `src/lib/patientDialogue.ts` |
| Keyword checklist coverage | `src/lib/checklistCoverage.ts`; `detectStudentChecklistCoverage()` |
| Legacy checklist score | `src/lib/checklistEvaluation.ts`; `evaluateEncounter()` |
| Shared faculty criteria | `src/lib/facultyRubric/sharedCriteria.ts` |
| Case-specific faculty rubrics | `src/lib/facultyRubric/caseRubrics.ts`; `C1-*` through `C5-*` |
| Faculty semantic/deterministic evaluation | `src/lib/facultyRubric/evaluation/*` |
| Faculty scoring | `src/lib/facultyRubric/scoring.ts` |
| Legacy structured report | `src/app/api/report/route.ts`; `buildStructuredReport()` |
| Canonical faculty report | `src/lib/facultyRubric/report/builder.ts`, `presentation.ts`, `pdf.ts` |
| On-screen report | `src/components/FacultyCaseReport.tsx`, `CanonicalCaseReport.tsx`, `CaseReport.tsx` |
| Examination event credit | `src/lib/checklistCoverage.ts`; any viewed examination credits `examination-findings` |
| Persistence | `src/lib/encounter/*`, `src/lib/localEncounter.ts`, Prisma Encounter/CompletedAttempt/faculty artifacts |
| Validation | `scripts/validateFacultyRubrics.mjs`, faculty scoring/report/PDF scripts, patient-intent scripts, Case-5 cold script |

## 5. Fact-to-implementation traceability matrix

The matrix groups tightly related facts where they share one storage/disclosure/rubric path. “Patient response” refers to the production API unless explicitly marked “legacy script.”

| Case | Canonical fact | Case data | Disclosure/patient behavior | Examination/diagnostics | Rubric/report/test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Age 52, left mandibular source | Age 34, lower-right | Wrong identity/fact supplied | Images described right-sided | Rubric expects bilateral swelling; no spec regression | Contradictory |
| 1 | Four-day pain, swelling progression, airway symptoms 12h | Pain 3d; swelling yesterday | Duration visible; 12h absent | Not encoded | Onset/progression broadly assessed | Partially aligned |
| 1 | Dysphagia, dyspnea supine, drooling, muffled voice, tongue elevation | Some in scripts/HPI; drooling/voice/tongue absent | Direct airway questions have no production topic; key HPI facts dropped | Detailed Word findings absent from data | C1-CF-001/003/004/005 require them | Unreachable |
| 1 | Bilateral board-like submandibular/sublingual swelling | Right-sided generic swelling | Swelling question can expose only generic/right fact | Images not semantically structured | C1-CF-002 expects bilateral | Contradictory |
| 1 | Diabetes, hypertension, metformin, lisinopril, smoking | Replaced with airway text and old filling | Cannot obtain canonical history | Not applicable | Mostly unassessed | Missing |
| 1 | Fever/chills and febrile vitals | Script says chills/no checked temperature | Fever question has no disclosure topic | Vitals correct | C1-IG-001 exists | Partially aligned |
| 1 | Ludwig's angina | Generic deep-space concern | Patient diagnosis blocked in API appropriately | Detailed diagnostic evidence missing | C1-CI/management mostly aligned; legacy report diagnosis generic | Partially aligned |
| 2 | Age 21, 7-day course, upper-right pain, 8/10 | Age 41, intense last night/one day, 7/10 | Wrong facts exposed | Location only generic | Rubric does not correct identity/course | Contradictory |
| 2 | Fever/chills/fatigue/weakness | Says run down but no fever | Fever question cannot unlock; legacy response denies noticed fever | Vitals show 38.4°C | C2-CF-002 requires elicited fever | Contradictory |
| 2 | Constant severe throbbing after earlier thermal pain | Lingering cold and throbbing but not constant progression | Pain topic may over-disclose several facts | Not encoded | Cold/lingering criteria exist | Partially aligned |
| 2 | Facial swelling, percussion/chewing pain; no airway signs | Mostly present | Swelling/pain available; airway negative unreachable | Detailed oral findings absent | Relevant rubric items exist | Partially aligned |
| 2 | Ibuprofen 400 mg PRN | Acetaminophen | Wrong medication response | Not applicable | Home-med criterion generic | Contradictory |
| 2 | WBC 14.8, normal lactate/BMP, CT abscess/cellulitis/no deep-space | Not stored | Patient should not invent | Only generic image | C2-MP labs/CT scored despite results unavailable | Missing |
| 2 | Systemic abscess/cellulitis, emergency/possible admission/IV antibiotics | “Acute apical abscess”; metadata Urgent | No diagnosis from patient | Evidence incomplete | Rubric says emergency, IV antibiotics, OMFS/admission | Contradictory |
| 3 | Age 25, right mandibular periapical abscess, 3 days | Age 52, left periodontal abscess, 1 week, diabetes | Entire wrong scenario exposed | Periodontal image description | Rubric mixes local abscess with wrong maxillary assumption | Contradictory |
| 3 | Ulcers; Pepcid; ibuprofen intolerance; otherwise healthy | Diabetes/hyperglycemia; salt-water rinse | Canonical facts unavailable | Not applicable | C3-MP-002 rewards ibuprofen | Contradictory |
| 3 | Constant 8/10 throbbing, ear radiation, biting pain | Dull ache; no severity/radiation | Pain generic; radiation absent | Not encoded | Some biting criteria, no faithful HPI | Missing |
| 3 | No fever/airway symptoms | No explicit fever; airway script exists | Fever/airway direct questions do not unlock correct facts | Vitals correct | Fever criterion exists | Unreachable |
| 3 | Crown/right mandibular first molar; uncertain root canal | Food trapping/bleeding/mobility | Wrong dental history | Wrong examination concept | C3 procedural rubric assumes maxillary | Contradictory |
| 3 | Fluctuant/purulent intraoral abscess; cold negative; percussion/palpation pain | Generic periodontal swelling image | Specific findings not stored for prompt | Only generic image | C3-CF-002 expects abscess; view event alone can credit exam | Missing |
| 3 | Drainage, block, antibiotic, acetaminophen, dental follow-up | Periodontal debridement/source control | Wrong plan context | Not applicable | I&D criterion exists; ibuprofen criterion unsafe | Contradictory |
| 4 | Five days, prior pain ceased then returned, possible broken old filling | “Bit something hard last week” | Unsupported trauma becomes canonical patient answer | Not applicable | Rubric still expects necrotic pulp | Contradictory |
| 4 | Constant 7/10 left mandibular pain; sharp biting pain | Quick pain only; says it stops with pressure | Wrong timing/character | Generic image | C4-CF-003 asks spontaneous pain despite canonical constant pain | Contradictory |
| 4 | No current cold response; prior cold pain | “Cold does not bother it much” | Can imply residual response rather than absent vitality | Pulp testing absent | C4-CI-003 broadly aligned | Partially aligned |
| 4 | Penicillin allergy with hives | “No allergy information reported” | Canonical allergy unreachable | Not applicable | C4-IG-002 grades allergy question | Missing |
| 4 | Deep caries/large filling, percussion/bite pain, no abscess | Large filling but cracked-tooth framing | Partial | Detailed findings absent | Rubric necrosis/percussion partially aligned | Partially aligned |
| 4 | Necrotic pulp with acute apical periodontitis | Cracked tooth/occlusal trauma | Patient diagnosis blocked; evaluator context wrong | No vitality result | C4-CI-002 conflicts with JSON diagnosis/report | Contradictory |
| 4 | No current antibiotics; document proposes conditional delayed Rx | Generic avoid-infection-treatment wording | Not patient fact | Not applicable | Rubric explains when antibiotics indicated | Ambiguous |
| 5 | Age 32; four-day course | Age 27; two weeks | Wrong demographic/course | Not applicable | Not directly assessed | Contradictory |
| 5 | Lower-left, constant/deep/throbbing 9/10, spontaneous/nocturnal | Pulsing 9/10/night; exact side/constant/deep absent | Pain question exposes partial facts | Generic image | C5-CF-003/004 aligned in concept | Partially aligned |
| 5 | Cold worsens and lingers after removal | Now stored as two facts | Case-specific disclosure correctly separates trigger/follow-up; legacy scripts separated | Cold test detail not in examination data | C5-IG-003/004 and C5-CI-003; focused test exists | Fully aligned |
| 5 | Slight bite/percussion pain | Not in data/scripts | Cannot be obtained | Not encoded | C5-IG-005 exists but marked provisional | Unreachable |
| 5 | No fever/swelling/drainage/airway symptoms | Some negatives; drainage absent | Swelling available; fever/airway direct questions weak/unreachable | Detailed negatives absent | Negative case-state criteria exist | Partially aligned |
| 5 | Healthy, ibuprofen 400 PRN, NKDA, tobacco/alcohol, access barrier | Adds pregnancy; omits smoking/alcohol; known postponed cavity | Some medication/allergy available; unsupported pregnancy | Not applicable | Pregnancy is graded via legacy clinical-4 although absent from spec | Unsupported by specification |
| 5 | No antibiotics; block; dental care ≤72h; asks access/tooth saving | Broad urgent evaluation/analgesia/no antibiotics | Goal/access facts not available | Not applicable | Faculty rubric mostly covers; legacy data omits access/goal | Partially aligned |
| All | Detailed examination recognition | Mostly generic image assets/descriptions | Patient only says image available in legacy engine | Viewing any image credits exam checklist without identified finding | Reports/rubric may award review, not recognition | Unassessed |
| All | Report statements should reflect obtained evidence | Expected data sent alongside transcript | AI instructed not to invent, but context includes all expected facts | Events record only view | Legacy report always lists expected supporting findings | Prematurely disclosed |

## 6. Discrepancy register

Every entry states the recommended correction and whether faculty confirmation is needed.

| ID | Sev. | Case/category | Canonical specification | Current implementation / why it matters | Files / identifiers | Recommended correction | Faculty? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-C1-001 | Critical | C1 contradiction | Age 52, left lower molar, bilateral Ludwig swelling | Age 34, right-sided pain/swelling; changes clinical evidence and invalidates bilateral rubric | Case 1 JSON metadata/history; `C1-CF-002` | Rebuild identity/laterality and all dependent facts from spec | Yes |
| AUD-C1-002 | Critical | C1 unreachable safety facts | Dysphagia, dyspnea supine, drooling, muffled voice, tongue elevation | Airway questions map to no production disclosure topic; several facts are not stored at all, so required emergency evidence cannot be elicited | `patientDisclosure.ts`; Case 1 HPI; `C1-CF-001/003/004/005` | Add structured airway facts and explicit prerequisites before any scoring activation | No for mechanics; yes for wording |
| AUD-C2-001 | Critical | C2 contradiction | Age 21, seven days, 8/10, systemic progression | Age 41, last-night/one-day course, 7/10 | Case 2 metadata/history/scripts | Replace course and severity from spec | No |
| AUD-C2-002 | Critical | C2 negative contradiction | Fever/chills and T 38.4°C | Script/history says no noticed fever; patient can deny a rubric-critical fact | `systemic_symptoms-standard`, `history.medicalHistory`, `C2-CF-002` | Store subjective fever/chills and make targeted fever response consistent with vitals | No |
| AUD-C2-003 | Critical | C2 urgency/diagnosis | Abscess with cellulitis/systemic infection; possible admission | JSON diagnosis is generic acute apical abscess and metadata is Urgent while rubric expects Emergency | Case 2 diagnosis/metadata; `C2-CI-001`, `C2-MP-*` | Align diagnosis, urgency, and management context | Yes |
| AUD-C3-001 | Critical | C3 wrong case | 25-year-old with right mandibular periapical abscess and ulcers | 52-year-old with diabetes and left periodontal abscess; nearly every clinical fact is for another scenario | Entire Case 3 JSON; `case03Criteria` | Replace Case 3 data from canonical document, preserving only app-required identity metadata | Yes |
| AUD-C3-002 | Critical | C3 grading mismatch | Mandibular first molar | Rubric explicitly rejects IAN block and selects maxillary infiltration | `C3-PD-001`, `C3-PD-002`, `C3-PD-003` | Re-author procedural criteria for mandibular location | Yes |
| AUD-C3-003 | Critical | C3 unsafe grading | Stomach ulcers; ibuprofen upsets stomach; use acetaminophen | Rubric rewards recommending ibuprofen | `C3-MP-002`; Case 3 JSON omits ulcers | Disable/correct criterion before active scoring | Yes |
| AUD-C4-001 | Critical | C4 diagnosis contradiction | Necrotic pulp with acute apical periodontitis | JSON diagnosis/report/learning framing is cracked tooth or occlusal trauma while rubric expects necrotic pulp | Case 4 diagnosis/differential/report; `C4-CI-002` | Rebuild Case 4 facts and diagnosis from spec | Yes |
| AUD-X-001 | Critical | Shared disclosure | Safety/systemic/periodontal facts must answer targeted questions | Topic model lacks airway, fever, trismus, drainage, periodontal bleeding, mobility, radiation, and goals; stored facts are dropped or unreachable | `PatientDisclosureTopic`, `topicFromPatientFact()`, aliases | Introduce data-driven disclosure prerequisites and validate reachability per case | No |
| AUD-C2-004 | High | C2 diagnostics missing | WBC/BMP/lactate and CT result in comments | Results absent from case/exam data but management rubric scores labs/CT | Case 2 examinations/supportingInfo; `C2-MP-002/005` | Add diagnostic result viewer/data and evidence mapping | Yes |
| AUD-C2-005 | High | C2 medication contradiction | Ibuprofen 400 mg PRN | Patient says acetaminophen | Case 2 medication script/history | Correct medication fact and related response | No |
| AUD-C3-004 | High | C3 examination omission | Fluctuant/purulent intraoral abscess, percussion/palpation findings, cold negative | Only generic periodontal image description exists | Case 3 examinations/examinationFindings | Implement canonical exam findings separately from patient knowledge | Yes |
| AUD-C3-005 | High | C3 management contradiction | Drainage, antibiotic, acetaminophen, dental follow-up | Periodontal debridement/diabetes plan replaces canonical plan | Case 3 management/report; `C3-MP-*` | Align management and safety-net expectations | Yes |
| AUD-C4-002 | High | C4 HPI contradiction | Prior pain stopped; returned over five days; possible broken filling | Fabricated hard-biting injury and quick-only pain | Case 4 onset/duration/scripts/HPI | Replace onset/character facts | No |
| AUD-C4-003 | High | C4 allergy omission | Penicillin causes hives | No allergy information; appropriate allergy question cannot yield canonical answer | Case 4 allergy history/script; `C4-IG-002` | Add allergy and reaction as staged facts | No |
| AUD-C1-003 | High | C1 examination omission | Board-like floor, tongue elevation, stridor, bilateral swelling | Generic right-sided images/descriptions do not encode critical recognition targets | Case 1 examinations/examinationFindings | Add canonical structured examination findings and evidence actions | Yes |
| AUD-C1-004 | High | C1 medical/social omissions | Diabetes, HTN, metformin, lisinopril, tobacco, affordability | Replaced by unrelated history | Case 1 history/HPI/scripts | Add canonical history with targeted disclosure | No |
| AUD-C5-001 | High | C5 contradiction | Age 32, four-day course | Age 27, two-week sensitivity course | Case 5 patient/history/scripts | Confirm whether product identity age is intentional; correct time course | Yes |
| AUD-C5-002 | High | C5 unsupported/omitted facts | Constant/deep pain, chewing discomfort, healthy status, smoking/access; no hot/radiation/pregnancy facts | Adds heat, ear radiation, pregnancy, postponed treatment; omits several canonical facts | Case 5 history/HPI/report | Remove unsupported facts and add canonical facts with prerequisites | Yes |
| AUD-X-002 | High | Shared exam grading | Student must recognize specific findings | Any examination view grants generic `examination-findings` credit; no finding comprehension is required | `detectClinicalChecklistCoverage()`, `C*-EX-001` | Separate “viewed” from “recognized finding” criteria | Yes |
| AUD-X-003 | High | Report evidence | Report should distinguish expected from obtained | Legacy report always emits `reportData.keyFindings` as supporting findings, even if never elicited/viewed | `buildStructuredReport()` lines using `reportData.keyFindings` | Label expected case state separately or filter by evidence | No |
| AUD-C1-005 | Medium | C1 script conflict | Breathing and swallowing require distinct answers | Two airway scripts share triggers; first wins ties, making swallowing-specific script unreliable | Case 1 `airway-6/7`; `findBestScriptedResponse()` | Use prerequisite-specific intents or deterministic tie resolution | No |
| AUD-C2-006 | Medium | C2 script over-disclosure | Hot/cold and lingering require staged questions | One thermal script answers every hot/cold question with lingering cold | Case 2 `thermal_sensitivity-6` | Split trigger, thermal direction, and lingering follow-up | No |
| AUD-C3-006 | Medium | C3 response mismatch | Fever question should yield no fever | Legacy systemic script answers with diabetes/hyperglycemia | Case 3 `systemic_symptoms-standard` | Correct after rebuilding Case 3 | No |
| AUD-C4-004 | Medium | C4 unreachable goals/history | Access and tooth-saving responses are explicitly prompted | Grinding and patient goals exist in wrong implementation but no production topics unlock them reliably | Case 4 HPI/history; disclosure aliases | Use explicit dental-access and goal prerequisites | No |
| AUD-C5-003 | Medium | C5 unreachable/unsupported | Canonical has no radiation | Unsupported ear-radiation fact is stored under location and “Does it radiate?” has no topic | Case 5 HPI; `topicFromPatientFact()` | Remove unless faculty retains it; otherwise add correct topic | Yes |
| AUD-X-004 | Medium | Shared premature disclosure | Specific follow-ups should gate specific facts | Non-broad `pain` questions expose all undisclosed pain facts; only Case 5 has a narrow exception | `selectAllowedFacts()` | Replace coarse topic release with fact-level prerequisites | No |
| AUD-X-005 | Medium | Shared lexical grading | Credit should reflect semantic question intent | Trigger matching can credit generic words such as “hot,” “open,” “taken,” or “temperature” in unrelated contexts | `checklistCoverage.ts`; JSON triggers | Prefer semantic/evidence rules and add negative tests | No |
| AUD-X-006 | Low | Shared maintainability | One canonical response per intent/prerequisite | Duplicate chief-complaint scripts in all cases; Case 5 also has duplicate numeric suffixes | All case JSON scripts | Enforce unique IDs and duplicate-trigger validation | No |
| AUD-X-007 | Low | Validation gap | Canonical documents should be regression anchors | Existing tests validate internal rubric shape and selected behaviors, not Word-to-JSON parity or fact reachability | `scripts/validate*` | Add extracted canonical fixtures after faculty approval | Yes |

## 7. OLD CARTS audit

Legend: C = canonically defined; A = available correctly to student; D = disclosed correctly; R = assessed; `—` = intentionally/not specified.

| Case | O | L | D | C | A | R(elieving) | T | S | Summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | C, wrong impl | C, contradictory side | C, partial | C, partial | C, analgesic failure partial | C, partial | C, partial | C, correct 8/10 | Airway progression and side are unsafe gaps |
| 2 | C, wrong impl | C, mostly upper only | C, wrong | C, partial | C, partial | Medication effect differs | C, systemic progression missing | C, wrong 7 vs 8 | Canonical week-long evolution is lost |
| 3 | C, wrong | C, wrong side/source | C, wrong | C, wrong dull vs throbbing | C, biting partial | No effective relief specified; NSAID intolerance missing | C, constant missing | C, 8/10 missing | Implemented case is unrelated |
| 4 | C, fabricated trigger | C, partial | C, wrong | C, wrong quick-only | C, biting yes | Ibuprofen inadequate partial | C, prior-stop/return missing | C, 7/10 missing | Diagnosis pattern is distorted |
| 5 | C, wrong 2w vs 4d | C, lower-left incomplete | C, wrong | C, partial | C, cold/bite partial | Ibuprofen inadequate partial | C, spontaneous/nocturnal partial | C, 9/10 correct | Cold/lingering now correct; rest incomplete |

All cases assess generic onset/duration/pain questions in legacy checklists, but assessment does not guarantee the correct canonical answer was available. Location is inconsistently assessed. Relieving factors are generally under-specified in rubrics even where clinically important.

## 8. Conceptual question tests

These are static predictions for the production disclosure path; no external LLM was called.

| Case | Question | Should unlock / remain hidden | Current behavior | Result |
| --- | --- | --- | --- | --- |
| 1 | “What brings you in?” | Opening airway-risk complaint only | Chief complaint only | Mostly correct, but wrong side/identity |
| 1 | “Are you having trouble swallowing?” | Dysphagia only | No matching topic; fact absent from visible set | Incorrect/unreachable |
| 1 | “Is it harder to breathe lying flat?” | Supine dyspnea only | No airway topic | Incorrect/unreachable |
| 1 | “Tell me about the pain.” | Quality/severity; airway facts hidden | May expose all pain-classified facts | Premature/incorrect facts |
| 1 | “You need to be admitted.” | Patient reaction, no new facts | Intent logic prevents fact release | Correct architecture |
| 1 | “What antibiotic dose did you take?” | Unknown; no precise dose | Medication fact may appear, but no dose | Partially correct |
| 2 | “Have you had a fever?” | Yes, fever/chills | No fever topic; legacy data says no noticed fever | Incorrect |
| 2 | “What happened over the last week?” | Seven-day progression | Data only last night/one day | Incorrect |
| 2 | “Does cold hurt?” | Earlier thermal pain; not necessarily lingering | Coarse pain disclosure/legacy script can give lingering immediately | Premature |
| 2 | “Does it persist after the cold?” | Lingering response only if canonical author intends checklist fact | No fact-level lingering separation | Incorrect granularity |
| 2 | “Can you swallow liquids?” | Yes/no inability; no dyspnea | Negative airway fact has no topic | Unreachable |
| 2 | “What did you take?” | Ibuprofen 400 mg PRN | Acetaminophen | Contradictory |
| 3 | “What brings you in?” | Constant right-lower pain/cannot chew | Left periodontal swelling | Wrong case |
| 3 | “Do you have diabetes?” | No; otherwise healthy | Yes, hyperglycemia | Contradictory |
| 3 | “Does ibuprofen bother you?” | Upsets stomach/ulcer context | Not available | Unreachable |
| 3 | “Does cold hurt?” | No | No correctly classified canonical fact | Unreachable |
| 3 | “Did that tooth have a root canal?” | “I am not sure.” | Not stored | Unreachable |
| 3 | “Do you have fever?” | No | No topic; legacy response discusses diabetes | Incorrect |
| 4 | “How did this start?” | Old pain stopped/returned; possible broken filling | Claims biting something hard | Contradictory |
| 4 | “Does cold affect it now?” | No response now; used to hurt | “Does not bother much” | Partially/ambiguously aligned |
| 4 | “What happens with penicillin?” | Hives | No allergy information | Unreachable |
| 4 | “Is the pain constant?” | Yes | Data emphasizes quick pressure pain | Contradictory |
| 4 | “Do you want to save the tooth?” | Yes | Goal topic absent in production | Unreachable |
| 4 | “You probably cracked it.” | Brief patient reaction; no new facts | Statement intent blocks new facts | Correct mechanics; wrong case context |
| 5 | “Does cold make it hurt?” | Cold worsens; lingering hidden | Trigger fact only | Correct |
| 5 | “Does it stop when cold is removed?” | Does not stop immediately | Lingering fact only | Correct |
| 5 | “How many seconds does it last?” | No exact duration; “a little while” | Qualitative fact, no number | Correct |
| 5 | “Does chewing hurt?” | Slight discomfort | No canonical fact stored | Unreachable |
| 5 | “How long has this been worsening?” | Four days | Two weeks | Contradictory |
| 5 | “Are you pregnant?” | Not specified in canonical document | Says not pregnant | Unsupported precision |

Repeated questions are reconstructed from prior student questions rather than actual patient answers. `inferDisclosedFactIds()` assumes every allowed fact was disclosed, even if the LLM omitted it. A repeat or follow-up can therefore hide a fact the patient never actually said. This is a cross-turn consistency risk for all cases.

## 9. Cross-case architecture findings

### Disclosure granularity

1. `extractPatientFacts()` ingests only fixed history fields plus HPI strings that `topicFromPatientFact()` recognizes.
2. Topic inference is lossy and order-sensitive: “hot” is classified as swelling before pain; any fact mentioning tooth/ear/area can become location before pain.
3. Question classification has no aliases for several script intents. The existence of a legacy scripted trigger does not make a fact available to `/api/conversation`.
4. Direct topic questions release all matching undisclosed facts, not the smallest answer to the question.
5. Disclosure state is inferred from provider questions, not confirmed patient output.
6. Case 5 has a bespoke thermal filter; this does not solve other cases and should not be generalized without canonical evidence.

### Script selection

The legacy engine appends intent synonyms to every script sharing that intent, then sorts only by score. Equal-score ties preserve source order. Duplicate trigger sets make later scripts effectively unreachable. Generic scripts can therefore override specific answers. The production API currently bypasses these scripts, creating two divergent behavior definitions that tests may exercise differently.

### Negative findings and contradiction risk

- Canonical negative findings are often grouped into one string or absent, so a targeted negative question may receive nothing.
- The LLM is told to maintain consistency, but contradictory source facts (especially Cases 2–4) make that impossible.
- Exact values such as age, duration, pain score, medication, and tooth location are already hard-coded incorrectly in several cases; this is not merely invention risk.
- Where the source is silent, the implementation invents names/gender for simulation needs and sometimes adds clinical facts (pregnancy, radiation, trauma). Clinical additions require faculty approval.

### Examination and diagnostics

Vital signs are aligned with the Word comments for all five cases. The remainder of the detailed examinations is mostly absent from structured data. Case 2 laboratory/CT results are entirely absent. The image viewer records only that an image was viewed, not which clinical feature was recognized. This weakens both learning validity and rubric evidence.

## 10. Rubric fairness findings

- Case 1 critical airway criteria are not fairly scoreable while the patient cannot reveal the required findings.
- Case 2 fever/systemic criteria conflict with the patient response data; diagnostics criteria lack a result surface.
- Case 3 procedural localization and ibuprofen criteria are clinically incompatible with the canonical case.
- Case 4 necrotic-pulp criteria conflict with the implemented diagnosis and HPI.
- Case 5 cold and lingering criteria are now well separated semantically; the generic biting criterion expects a canonical fact that is unavailable.
- The faculty rubric contains many provisional weights and unsupported criteria. Existing validation reports these but does not compare them to the Word documents.
- Keyword checklist coverage measures whether a word was used, while the semantic faculty evaluator measures evidence. Reports can therefore differ depending on which pipeline is displayed or persisted.

## 11. Report consistency

The canonical faculty report is criterion/evidence-driven and preserves the actual transcript, which is the safer design. The legacy `/api/report` path also embeds the transcript and deterministic coverage but unconditionally places `supportingInfo.reportData.keyFindings` in `clinicalReasoning.supportingFindings`. Those are expected case facts, not necessarily findings obtained by the learner.

The on-screen and PDF canonical faculty reports share presentation data and transcript order. Their correctness still depends on the rubric and case identity supplied. A perfectly rendered report can therefore confidently grade the wrong case (especially Cases 3 and 4).

## 12. Clinical-review findings

Faculty/dental-expert confirmation is required for:

1. Whether Case 4 intentionally uses a delayed antibiotic prescription despite stating antibiotics are not currently needed.
2. The Case 3 acetaminophen instruction of 1000 mg every four hours, which can exceed common maximum daily dosing; the simulation should not encode it without safety review.
3. Whether names/gender and altered ages are intentional standardized-patient adaptations or accidental drift.
4. Whether the Case 2 cold-lingering checklist item describes a current or historical symptom; the HPI says pain is now constant.
5. Whether Case 1's airway should be called “patent” in `C1-CI-001` despite stridor, increased work of breathing, tongue displacement, drooling, and positional choking.
6. Whether any Case 5 hot sensitivity, radiation, pregnancy screening, or known postponed cavity is intended; none appears in the canonical document.

## 13. Recommended remediation sequence

| Priority | Change | Scope | Faculty approval | Automated test |
| ---: | --- | --- | --- | --- |
| 1 | Rebuild Cases 1–4 JSON facts from their matching Word documents | Case-specific | Yes | Required |
| 2 | Correct Case 2 fever/systemic facts and Case 3 NSAID safety mismatch | Case-specific | Yes | Required |
| 3 | Add fact-level reachability validation and disclosure prerequisites | Shared | No for mechanism | Required |
| 4 | Correct Case 3 location/anesthesia rubric and Case 4 diagnosis rubric/data agreement | Case-specific | Yes | Required |
| 5 | Add structured examination/diagnostic findings, including Case 2 labs/CT | Case-specific plus shared viewer/evidence model | Yes | Required |
| 6 | Align Case 5 age/time course and remove or approve unsupported additions | Case-specific | Yes | Required |
| 7 | Separate broad pain answers from targeted trigger, persistence, severity, radiation, and timing facts | Shared with case data | No | Required |
| 8 | Remove duplicate scripts and define deterministic specificity/tie rules | Shared | No | Required |
| 9 | Record facts actually spoken, rather than infer disclosure solely from questions | Shared | No | Required |
| 10 | Keep expected report facts separate from learner-obtained evidence | Shared report | No | Required |

No fixes should be implemented until faculty selects whether the Word documents override every conflicting repository fact and resolves the clinical-review questions above.

## 14. Proposed automated validations

1. A faculty-approved machine-readable fixture extracted from each Word specification.
2. JSON parity tests for age, location, duration, severity, medication/allergy, diagnosis, and vital signs.
3. A reachability test proving every rubric-required conversational fact appears in `allowedThisTurn` for at least one appropriate semantic question.
4. A privacy test proving every restricted fact remains hidden before its prerequisite.
5. Negative-question tests for fever, swelling, airway, drainage, cold, spontaneous pain, and allergies.
6. Script conflict tests detecting equal-scoring responses and duplicate IDs/triggers.
7. Cross-turn tests based on actual patient output, including omitted-fact recovery and repeated questions.
8. Examination tests separating viewed, interpreted, and correctly recognized findings.
9. Report tests ensuring “obtained findings” have transcript/examination evidence.
10. Clinical dose/range validation for medication instructions.

## 15. Stronger case specification format

Future cases should use a versioned structured source that separates clinical truth from patient disclosure and assessment.

```yaml
schemaVersion: 2
identity:
  caseId: case-05
  displayName: Sofia Williams
  age: 32
  gender: not-specified
  setting: emergency-department
clinicalFacts:
  - id: pain.cold.trigger
    value: cold worsens pain
    precision: qualitative
  - id: pain.cold.persistence
    value: pain does not stop immediately after cold removal
    precision: no-exact-duration
negativeFindings:
  - fever
  - facial-swelling
  - drainage
  - dysphagia
  - voice-change
  - dyspnea
patientKnowledge:
  known:
    - pain.cold.trigger
    - pain.cold.persistence
  unknown:
    - final-diagnosis
disclosureRules:
  - fact: pain.cold.trigger
    whenAny:
      - asks-cold-effect
      - asks-thermal-trigger
    responseScope: answer-only
  - fact: pain.cold.persistence
    whenAny:
      - asks-whether-cold-pain-stops
      - asks-duration-after-cold
    responseScope: answer-only
scriptedResponses:
  - intent: asks-cold-effect
    response: Cold drinks make it hurt more.
  - intent: asks-duration-after-cold
    response: It does not stop right away. It keeps hurting for a little while.
examinations:
  - id: cold-test
    findings:
      - fact: pain.cold.trigger
      - fact: pain.cold.persistence
diagnosis:
  final: irreversible-pulpitis
rubricMappings:
  - criterion: asked-about-cold-pain
    evidenceFrom: provider-question
  - criterion: asked-about-lingering-cold-pain
    evidenceFrom: provider-follow-up
reportMappings:
  expectedFindings:
    - pain.cold.trigger
    - pain.cold.persistence
  obtainedFindingsRequireEvidence: true
validation:
  - every-required-fact-reachable
  - no-fact-before-prerequisite
  - no-unsupported-numeric-duration
```

The schema should distinguish “not specified” from a negative finding, distinguish patient-known facts from examiner-only findings, and make rubric/report provenance explicit.

## 16. Open questions for the faculty author

1. Are the five Word documents authoritative over all current JSON facts, including ages and tooth laterality?
2. Are Amara, Marcus, Elena, Noah, and Sofia intended names, and are their configured genders intentional additions?
3. Should Case 1 be explicitly diagnosed as Ludwig's angina rather than generic deep-space concern?
4. In Case 2, should lingering cold pain remain a current answer after pain becomes constant?
5. Should Case 2 be labeled Emergency rather than Urgent?
6. Is Case 3 definitely mandibular, and should all maxillary anesthesia criteria be removed?
7. What analgesic ceiling and interval should Case 3 teach given ulcers/NSAID intolerance?
8. Should Case 4 include a delayed antibiotic prescription, or only safety-net instructions to return if infection develops?
9. Is Case 4's intended diagnosis strictly necrotic pulp with acute apical periodontitis?
10. For Case 5, should any hot sensitivity, radiation, pregnancy status, or prior postponed cavity remain?
11. Should examination credit require identifying specific findings rather than opening an image?
12. Which report pipeline is authoritative for faculty use: canonical rubric artifacts or legacy `/api/report`?

## 17. Audit limitations and worktree note

- Word comments were accessible and included. No tracked-change deletion history was reconstructed, and no author intent beyond visible document content/comments was inferred.
- Images embedded in the Word documents were not interpreted as independent clinical evidence; the accessible surrounding text/comments defined the findings.
- No external LLM was called. Conceptual tests are deterministic static analysis of prompts, facts, matching, and scoring paths.
- At audit start, the worktree already contained modified implementation files from the preceding Case 5 task: `package.json`, Case 5 JSON, `conversationEngine.ts`, `patientDisclosure.ts`, and an untracked Case-5 validation script. This audit did not modify those files. The only file created by this audit is `docs/case-spec-audit.md`.
