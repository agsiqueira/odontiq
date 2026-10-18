import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const out = path.resolve('validation/transportation-2026-10-17');
const root = 'C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/runs';
const runs = readdirSync(root).filter(f=>f.includes('2026-10-17') && /patient-(?:background|residence-recovery|travel-distinction|transportation-capability)_/.test(f) && !f.includes('research-exclusion')).map(f=>({sourceFile:path.join(root,f),...JSON.parse(readFileSync(path.join(root,f),'utf8'))})).filter(r=>r.startedAt>='2026-10-17T13:45:00Z').sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
const turns = runs.flatMap(r=>r.turns.map(t=>({scenarioId:r.scenarioId,runId:r.runId,caseId:r.caseId,encounterId:r.encounterId,...t})));
const groups = [...new Set(runs.map(r=>r.scenarioId.startsWith('transportation-capability')?'transportation-capability':r.scenarioId.startsWith('residence-')?'residence':r.scenarioId.startsWith('travel-distinction')?'travel-distinction':r.scenarioId))].map(group=>{const selected=turns.filter(t=>group==='transportation-capability'?t.scenarioId.startsWith(group):group==='residence'?t.scenarioId.startsWith('residence-'):group==='travel-distinction'?t.scenarioId.startsWith(group):t.scenarioId===group);return {group,total:selected.length,passed:selected.filter(t=>t.status==='PASS').length,failed:selected.filter(t=>t.status==='FAIL').length,blocked:selected.filter(t=>t.status==='BLOCKED').length};});
const json=(name,data)=>writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');
json('live-results.json',{generatedAt:new Date().toISOString(),groups,runs});
json('research-exclusion.json',{purpose:'Exclude every listed synthetic Phase T encounter from participant research.',encounters:runs.map(r=>({encounterId:r.encounterId,caseId:r.caseId,runId:r.runId,scenarioId:r.scenarioId,startedAt:r.startedAt})),historicalIncidentEncounter:'b8a9ccc1-f861-494e-87f3-9b47f781800e (historical record; not a synthetic encounter created by this task)'});
const files=['src/lib/patientDisclosure.ts','src/lib/patientTransportation.ts','src/lib/patientOutputGuard.ts','src/app/api/conversation/route.ts','scripts/validatePatientTravel.ts','scripts/investigateTransportation.ts','scripts/reportTransportationIncident.mjs','scripts/validateRecordedTransportation.ts'];
json('source-hashes.json',files.map(file=>({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')})));
const exact=turns.filter(t=>t.question==='can you travel for Affordable Care');
writeFileSync(path.join(out,'REPORT.md'),[
'# Case 01 transportation incident — October 17, 2026',
'',
'Fixed locally; not deployed. Existing working-tree changes were retained. No case JSON, clinical facts, grading, UI, or historical participant records were changed by this task.',
'',
'## Recorded evidence and server identity',
'Local port 3000 belongs to PID 24364, Next.js start-server.js under C:/240 - odontIQ/odontiq. Process creation: October 17, 09:35:50 America/New_York. Git HEAD: edae56cb34e9a99ada0e1e2e10544686b126dd61, with pre-existing working-tree edits. server.json records the listener and command line; source-hashes.json records final changed-source hashes. Next.js 16.2.10 development server hot-reloaded the fix; the authenticated live results confirm the updated behavior. Compiled development chunks contain the defined reliable-transportation fact.',
'The exact final response was recovered by a read-only database query: encounter b8a9ccc1-f861-494e-87f3-9b47f781800e; request case-01-1792244300088-7-response; student message case-01-1792244300088-7; provider navigator; stored at 2026-10-17T13:38:21.657Z (09:38:21 EDT). Stored Student text exactly matches the report. Encounter version 22 remained unchanged across the audit.',
'The route loads patientCase with loadCase(payload.caseId) from the current case module, not from an encounter case-fact snapshot. Stored encounter keys and matching messages are in before.json and after.json. The historical encounter has 11 messages before this Student turn; replay identifies already-disclosed chief complaint, residence, tooth location and dyspnea, without a disclosed transportation fact. No evidence of a stale transportation fact snapshot was found.',
'',
'## Root cause and pipeline trace',
'Before any edit, the exact question classified as radiation, with no selected facts and no required facts. The old transportation matcher allowed travel for care or dental care, but not affordable care; its separate destination matcher required clinic/county/town/dental care. The generic radiation matcher recognized travel. The captured final response passed assessPatientOutputIntegrity even with all canonical facts supplied (before.json).',
'Prompt construction exposes only allowedThisTurn and alreadyDisclosed. Missing intent therefore omitted the defined transportation capability and willingness from the new-information prompt and admitted unknown-information wording. The system explicitly permits uncertainty for unavailable information. The immediate-response path contains no transportation answer; matched transportation questions continue to Navigator. The route sends recent conversation plus the current message, using Navigator temperature 0.4.',
'Response validation normalizes provider text, checks role, leakage, required facts and stable contradictions. A rejection triggers one provider retry with PATIENT_ROLE_REPAIR_PROMPT, then a selected-fact fallback. Previously neither the missing required fact nor a general transportation contradiction rule rejected this recorded uncertainty. The fact-backed transportation fallback already existed, but could not run meaningfully when no transportation fact was selected.',
'The historical raw Navigator text, individual retry outputs, and behavior candidate were not persisted. The recorded final response/provider and pre-fix validation result are evidence; attributing its exact wording to an initial generation versus retry or behavior addition would be inference. Existing approved behavior phrases do not define a travel limitation. The investigation does not claim a raw historical provider trace that is unavailable.',
'After the fix, the exact question selects background_transportation only, requires c1.background-transportation, rejects the recorded uncertainty and includes the defined fact in the prompt. after.json also traces selection using the recovered historical conversation. The matcher covers travel/access with care, treatment, clinic and county, including reversed treatment/travel phrasing. Radiation, explicit residence, and combined questions retain dedicated regression checks.',
'The prompt reinforces that pain changes tone without changing defined travel capability or willingness. The guard rejects travel uncertainty/limitations even when appended to an affirmative answer, and rejects canonical transportation uncertainty outside a required-fact turn. Unknown clinic distance remains permitted. Cases 03–05 continue to use their unspecified-transport boundary rather than acquire invented facts.',
'Behavior rendering receives governed facts; presentation is revalidated and rolls back to the safe answer if invalid. patientQuestionService validates the fully assembled response after adding any approved patient question and before state/dialogue writes. This existing final validation is preserved and now receives the stronger transportation checks. Retry log correlation now uses requestId, with encounterId retained separately.',
'',
'## Files changed by this task',
...files.map(f=>'- '+f),
'- Phase T: tests/browser/patient-transportation-capability.spec.ts; playwright.config.ts (register new spec only).',
'- validation/transportation-2026-10-17: incident evidence, results and research exclusion manifest.',
'Existing background, travel-distinction and residence-recovery test matchers were not changed. The new capability suite adds stricter rejection of uncertainty. No existing acceptance criteria were relaxed and no historical test results were replaced.',
'',
'## Automated checks',
'Passed: transportation (80 fresh/history checks, five residence controls, combined intent and clinical radiation; captured failure, appended uncertainty, non-required-turn contradiction and final-assembly rejection); background (18 targeted questions plus clinical/grading scope); background conflicts (25); residence (30 plus 10 clinical location); residence recovery (40); leakage (15 variants, 10 natural controls, 120 stage renders and retry/rollback); output integrity; patient questions; behavior stages (91 assertions); strict canonical parity (zero mismatches); app TypeScript; Phase T TypeScript; targeted ESLint; production build; git diff --check.',
'The final guard also revalidates all 78 captured real Navigator/UI capability and pain answers (recorded-response-revalidation.json). These are recorded-response checks, not new provider generations. Clinical radiation uncertainty is explicitly distinguished from personal transportation uncertainty. Active route bundle hashes and the loaded canonical fact/prompt are recorded in compiled-active.json.',
'The initial sandboxed read-only database query could not reach the configured database; the same query succeeded with reviewed network access. Initial OS process/listener inspection was also denied by the sandbox and then succeeded with reviewed access. These were resolved investigation access restrictions, not failed patient tests. All live test failures/blockers, if any, are listed below and retained in live-results.json.',
'',
'## Live results',
'Existing Phase T Clerk authentication; real localhost UI, real Navigator; one worker; retries=0. Every generated turn checks final UI/API equality, HTTP success, encounter/request correlation, provider=navigator, semantics and leakage. Each scenario creates a fresh dedicated test encounter and writes an exclusion record. Three capability encounters each exercise six questions early, establish severe pain, then repeat all six questions. Final verification reruns, when present, are retained separately by runId.',
...groups.map(g=>`- ${g.group}: ${g.passed}/${g.total} passed; ${g.failed} failed; ${g.blocked} blocked.`),
'',
'Failures/blockers: '+(turns.some(t=>t.status!=='PASS')?'See the retained records below.':'None in recorded live turns.'),
...turns.filter(t=>t.status!=='PASS').map(t=>`- ${t.runId} / ${t.id}: ${t.status}; ${JSON.stringify(t.reasons)}`),
'',
'## Actual final answers to the exact failing question',
...exact.flatMap(t=>[`- Encounter ${t.encounterId}; ${t.id}; request ${t.requestId}; ${t.status}`,`  ${t.actualFinalPatientResponse}`]),
'',
'## Research exclusion',
'research-exclusion.json lists every synthetic encounter created by these runs, including any failed or blocked scenario. The historical incident encounter is identified separately and must not be relabeled as a synthetic encounter created by this task.',
...runs.map(r=>`- ${r.encounterId} (${r.caseId}; ${r.scenarioId}; ${r.runId})`),
'',
'All final responses, phrasing-level results, request IDs, failures, timings and original report paths are preserved in live-results.json. Original Phase T reports remain in artifacts/reports/runs. No deployment performed.',
''].join('\n'));
console.log(JSON.stringify({groups,runs:runs.length,turns:turns.length,failures:turns.filter(t=>t.status!=='PASS').length},null,2));
