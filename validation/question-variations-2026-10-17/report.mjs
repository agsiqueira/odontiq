import {readFileSync,writeFileSync,existsSync,statSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const out=path.resolve('validation/question-variations-2026-10-17');
const load=name=>JSON.parse(readFileSync(path.join(out,name),'utf8'));
const summary=load('summary.json'),primary=load('primary-results.json'),pain=load('pain-context-results.json'),before=load('application-before.json'),registry=load('research-exclusion.json');
const changes=before.files.filter(f=>!existsSync(f.path)||createHash('sha256').update(readFileSync(f.path)).digest('hex')!==f.sha256);
writeFileSync(path.join(out,'application-after-comparison.json'),JSON.stringify({checkedAt:new Date().toISOString(),checkedFiles:before.files.length,changedApplicationFiles:changes,unchanged:changes.length===0},null,2));
const rows=[...primary,...pain];
const initial=existsSync(path.join(out,'initial-run-summary.json'))?load('initial-run-summary.json'):null;
const complete=summary.accounting.executedPrimary===340&&summary.accounting.executedPain===20;
const patterns=[
 ['Wrong concept / irrelevant clinical answer',r=>/tooth location|pain timeline|dental-pain timeline|does not answer|substitutes|instead of answering/i.test(r.reason),'Broaden intent normalization for paraphrases and grammar variants, keep financial/residence/coverage timelines distinct from clinical questions, and require the requested fact rather than any true fact.'],
 ['Invented facts or unsupported restrictions',r=>/invents|invented|unsupported|contradict/i.test(r.reason),'Validate unsupported assertions as well as missing required facts, including free-text additions and statements about family transport, residence, dates, finances and coverage ownership.'],
 ['Combined-question or family-reference gaps',r=>/both|combined|daughter|parent|dentist status|current overall insurance|another current plan/i.test(r.reason),'Track every requested slot and bind pronouns to the established person/concept; require completion of both insurance/dentist and other combined questions.'],
 ['Unsupported uncertainty about known facts',r=>/uncertainty|hesitation|unknown-information|unsure/i.test(r.reason),'Use unknown-information replies only for unspecified facts; apply complete fact checks to alternate willingness, option and reliability formulations.'],
 ['Payment ability versus willingness',r=>r.groupId==='G17'&&r.outcome==='FAIL','Preserve the zero-payment boundary across small-fee, reduced-fee, copayment and affordability phrasing. Separate ability to pay from preference or willingness; combined free-clinic/ability questions need both parts.'],
 ['Ambiguous responses retained for human review',r=>r.outcome==='REVIEW','Review these examples before changing behavior; refine evaluator criteria only with explicit documented justification, without weakening the current regression matchers.'],
 ['Execution or context blockers',r=>r.outcome==='ERROR'||r.outcome==='BLOCKED','Resolve the recorded authentication/provider/context blocker before repeating; preserve first-run results and label any new encounter as a retry.']
].map(([name,test,proposal])=>({name,ids:rows.filter(r=>r.outcome!=='PASS'&&test(r)).map(r=>r.testId),proposal})).filter(g=>g.ids.length);
writeFileSync(path.join(out,'failure-patterns.json'),JSON.stringify(patterns,null,2));
const table=(heading,data,label)=>['## '+heading,'','| '+label+' | PASS | FAIL | REVIEW | ERROR | BLOCKED |','|---|---:|---:|---:|---:|---:|',...data.map(r=>`| ${r.label} | ${r.PASS} | ${r.FAIL} | ${r.REVIEW} | ${r.ERROR} | ${r.BLOCKED} |`),''];
const allApi=rows.flatMap(r=>[...(r.setupTurns??[]).flatMap(t=>t.apiAttempts??[]),...(r.apiAttempts??[])]);
const setupDefects=rows.filter(r=>r.setupObservations?.length);
const examples=['C01-G02-Q12','C01-G03-Q09','C02-G05-Q19','C03-G09-Q04','C03-G10-Q17'].map(id=>primary.find(r=>r.testId===id)).filter(r=>r?.finalResponse);
const reviews=rows.filter(r=>r.outcome==='REVIEW');
const pairs=pain.map(r=>({testId:r.primaryTestId,primaryOutcome:primary.find(p=>p.testId===r.primaryTestId)?.outcome??'BLOCKED',painOutcome:r.outcome,primaryFinalResponse:primary.find(p=>p.testId===r.primaryTestId)?.finalResponse??null,painFinalResponse:r.finalResponse}));
writeFileSync(path.join(out,'pain-primary-comparison.json'),JSON.stringify(pairs,null,2));
const packageInfo=JSON.parse(readFileSync('C:/240 - odontIQ/odontiq-phase-t/node_modules/@playwright/test/package.json','utf8'));
const metadata={generatedAt:new Date().toISOString(),complete,head:before.head,applicationUnchanged:changes.length===0,applicationFilesHashed:before.files.length,playwrightVersion:packageInfo.version,baseUrl:'http://localhost:3000',workers:1,harnessRetries:0,minimumTurnPacingMs:1000,recordedConversationCalls:allApi.length,providers:[...new Set(allApi.map(a=>a.provider))],httpStatuses:[...new Set(allApi.map(a=>a.httpStatus))],firstStartedAt:rows.filter(r=>r.startedAt).map(r=>r.startedAt).sort()[0],lastCompletedAt:rows.filter(r=>r.completedAt).map(r=>r.completedAt).sort().at(-1),primaryResults:summary.primaryTotals,painContextResults:summary.painContextTotals,syntheticEncounterCount:registry.encounters.length};
metadata.automaticPlaywrightRetries=0;metadata.manualSetupRetryAttempts=3;metadata.scoredResponseReruns=0;delete metadata.harnessRetries;
writeFileSync(path.join(out,'execution-metadata.json'),JSON.stringify(metadata,null,2));
writeFileSync(path.join(out,'REPORT.md'),[
'# OdontIQ — 340 question variations and 20 pain-context tests',
'',
`Generated ${metadata.generatedAt}. Execution ${complete?'complete':'still in progress'}. Test and report only: no application code/fact changes, deployment or historical participant edits.`,
'',
`Primary inventory: **${primary.length} rows, ${summary.accounting.uniquePrimaryIds} unique IDs, 17 groups, five cases**. Executed primary: ${summary.accounting.executedPrimary}/340. Additional pain-context: ${summary.accounting.executedPain}/20, reported separately. Each final primary ID appears exactly once. Additional raw status/attempt records: ${summary.accounting.duplicateRawAttempts}, comprising retained setup errors/stop records and their continuations, not repeated scored answers.`,
'',
...table('Evaluated primary totals by case',summary.byCase.map(r=>({...r,label:r.caseId})),'Case'),
...table('Primary totals by question group',summary.byGroup.map(r=>({...r,label:`${r.groupId} — ${r.caseId} — ${r.title}`})),'Group'),
...table('Overall and separate context totals',[{label:'340 primary tests',...summary.primaryTotals},{label:'20 additional Case 01 pain-context tests',...summary.painContextTotals}],'Cohort'),
...(initial?table('Retained initial-run totals before harness continuation',[{label:'Initial primary run',...initial.primaryTotals},{label:'Initial pain-context stop records',...initial.painContextTotals}],'Initial cohort'):[]),
'## Pain-context comparison','',
'All 20 travel wordings are repeated after a brief pain discussion in separate encounters. pain-primary-comparison.json retains paired outcomes and final answers. These are single stochastic observations per wording/context; differences cannot be attributed causally to pain alone. The first setup establishes current 8/10 pain. A historical initial 3/10 answer on the second setup does not replace that current severity.','',
'## Items retained for human inspection','',
...reviews.map(r=>`- ${r.testId}: ${r.reason}`),'',
'## Method and configuration','',
'The entire supplied Markdown file was read, including expected meanings, facts and context requirements. Parsing asserts exactly 340 unique IDs, 20 questions in each of 17 groups across five cases. The copied source and inventory.json preserve wording, capitalization and intentional grammar errors byte-for-byte within each question cell; the original document SHA-256 is recorded.',
`Application root: C:/240 - odontIQ/odontiq. HEAD: ${before.head}. This was an existing dirty working tree; application-before.json preserves its initial status and hashes of ${before.files.length} application files. Final comparison: ${changes.length===0?'all hashed application files unchanged':'APPLICATION FILE DRIFT FOUND — see application-after-comparison.json'}. Next.js 16.2.10 development server, localhost:3000, PID 24364, verified checkout command line and active route hashes. All 16 defined background facts were found in the active route bundle. No stale case snapshot was substituted by the harness.`,
`Phase T root: C:/240 - odontIQ/odontiq-phase-t. Playwright ${packageInfo.version}, bundled Chromium with Desktop Chrome profile, one worker, retries=0, at least one second between conversation submissions. Existing Clerk development authentication and dedicated account were reused; no credentials appear in result tables.`,
'Command: `npx playwright test --config=playwright.questions.config.ts --project="question variations" --workers=1 --retries=0`. Phase T TypeScript check passed before execution. New isolated config and study spec were added; existing regression matchers and test specs were unchanged.',
'Every scored question receives a fresh dedicated encounter, navigated through the real case card and conversation UI. Fresh server binding and transcript isolation are checked before setup. The exact scored message is confirmed in the API request. Final UI text must equal final API text; request and encounter IDs, HTTP status and actual provider are retained. There are no mocked patient responses. Grouping in the runner is only reporting/execution organization: 20 variations are never asked consecutively in one encounter.',
'Context setup is stored separately. Medicaid follow-ups establish prior/lost coverage; “there” establishes Collier; “she”/“your child” establishes the daughter; shared-clinic items establish daughter and dental care for both without stating the preferred answer. The 20 additional travel tests each have a separate fresh encounter with a brief severe-pain discussion before the unchanged travel question. See EVALUATOR.md for exact setup wording and checks.',
'',
'## Evaluator and interpretation','',
'The recorder initially assigns successful responses REVIEW rather than using a keyword PASS. Each final answer was then individually reviewed by the assistant with its exact question, context and defined facts. Explicit decisions are keyed to run ID and response hash in adjudications.json; raw records are unchanged. EVALUATOR.md documents the rules and limitations. This is assistant semantic review, not an independent clinician panel or calibrated semantic model.',
'Unambiguous short contextual answers are accepted. Named-county confirmations count for residence; county statements do not count for travel. Combined questions require all requested parts. Parent insurance is kept separate from daughter Medicaid. Known facts cannot be replaced with uncertainty, while unspecified details cannot be invented. Uncertain interpretations remain REVIEW. A financial or transport assertion is not licensed merely by being plausible.',
'Approximate “about a year”/“last year” coverage loss is treated as compatible with the defined past-year timeframe, as in existing acceptance wording. A specific six-month interval is unsupported. True clinical/background additions do not automatically fail a response that fully answers the question; irrelevant clinical-only answers fail. These conventions are explicit so a reviewer can reassess borderline judgments.',
`Recorded successful/failed conversation observations (setup plus scored): ${allApi.length}; provider values: ${metadata.providers.join(', ')}; HTTP statuses: ${metadata.httpStatuses.join(', ')}. The application's initial Navigator generations, internal corrective retry contents, fallbacks and behavior candidates are not separately exposed by the black-box API. This study evaluates the fully assembled final guarded response and does not claim to recover those internal traces.`,
'Runner group completion is not a patient-response PASS. The outcome tables and CSV/JSON semantic decisions are authoritative for this study.',
'',
'## Recurring failure patterns and proposed fixes — not implemented','',
'Representative recorded answers (all final UI/API text):','',
'| Test ID | Exact question | Final response |','|---|---|---|',
...examples.map(r=>`| ${r.testId} | ${r.question.replaceAll('|','\\|')} | ${r.finalResponse.replaceAll('|','\\|')} |`),'',
'Patterns below may overlap; counts are observations, not mutually exclusive root-cause diagnoses. No proposed fix was implemented.',
...patterns.flatMap(p=>[`### ${p.name} (${p.ids.length})`,``,p.proposal,``,p.ids.slice(0,12).join(', ')+(p.ids.length>12?' … Full ID list: failure-patterns.json.':''),``]),
'## Setup observations','',
`Setup turns are not part of the 340 scored questions. ${setupDefects.length} scored items have separately documented setup defects/limitations. A usable referent does not make an invented setup detail acceptable, and setup text is not treated as an authoritative new case fact.`,
...setupDefects.filter(r=>r.cohort!=='pain-context').map(r=>`- ${r.testId}: ${r.setupObservations.join(' ')}`),
`- ${setupDefects.filter(r=>r.cohort==='pain-context').length} pain-context items: second setup answered historical initial 3/10 rather than current feelings, after first setup explicitly established current 8/10. Per-item notes and actual setup text remain in the pain-context CSV/JSON.`,
'',
'## Execution limitations and retained failures','',
`${complete?'All requested scored items were executed.':'Execution remains incomplete; unexecuted rows are marked BLOCKED, not passed.'} Playwright automatic retries remained zero. No already-scored patient response was rerun. Three setup/card-selection attempts were retried after correcting the harness fixture, and all original ERROR/BLOCKED records are retained. Authentication or provider errors, if present, retain their original reason and evidence. Rate-limit handling pauses rather than fabricating results.`,
'The initial runner used incorrect patient-name fixture labels for Cases 03–05. Three Case 03 card-selection attempts failed before a scored request; the safety stop recorded 197 remaining primary and 20 pain-context items as BLOCKED without executing them. Correcting only the Phase T fixture enabled continuation. All 140 already-correlated responses, including semantic failures, were skipped and retained. Three failed setup items use attempt-2 fresh encounters; the other 217 stopped items receive their first actual execution. The final evaluated primary table chooses the first valid scored response per ID, with prior attempt IDs/outcomes retained. Initial-run CSV/JSON and summary tables preserve the unsuccessful run; all raw records remain. This was not an application fix or matcher relaxation.',
'The initial accounting counter counted blocked placeholder records as executed; it was corrected to count actual final responses and request IDs. The uncorrected initial summary is retained alongside the corrected initial-run summary. No patient-response acceptance criterion changed.',
'The supplied inventory contains no dedicated transportation questions for Cases 03–05. Their outputs were checked for unsolicited invented transportation details; this study does not claim exhaustive transport-intent coverage for those cases.',
'Auth/session data in private Playwright traces must be handled as test artifacts, not published publicly; result CSV/JSON contains no credentials.',
...rows.filter(r=>r.outcome==='ERROR'||r.outcome==='BLOCKED').map(r=>`- ${r.testId}: ${r.outcome} — ${r.reason}`),
'',
'## Deliverables and research exclusion','',
'- primary-results.csv / primary-results.json: exactly one row per primary ID, with exact question, setup turns, actual final UI/API text, outcome/reason, encounter and request IDs, provider and artifact paths.',
'- pain-context-results.csv / pain-context-results.json: the 20 separate pain-context tests and their primary-ID relationships.',
'- summary.json, execution-metadata.json, application-before.json, application-after-comparison.json, server.json, active-server-chunks.json and loaded-background-facts.json: accounting, configuration and version evidence.',
'- export-verification.json: independent CSV/JSON round-trip, exact wording/ID coverage, UI/API equality, encounter uniqueness, failure/REVIEW/ERROR trace ZIP checks, and unchanged application/regression-file checks. All passed.',
'- all-raw-attempts.json and original Phase T raw/*.json: original automated outcomes and unsuccessful runs. decisions.json/adjudications.json preserve semantic-review provenance.',
'- initial-run-primary-results.csv/json, initial-run-pain-context-results.csv/json and initial-run-summary.json preserve the initial run, including every ERROR/BLOCKED item before the fixture correction. The final tables clearly identify continuation and setup-retry records.',
`- research-exclusion.json: **${registry.encounters.length} deduplicated synthetic encounter IDs**, including any setup, incidental, incomplete or retry encounters observed through encounter-start events. Original registration events remain in Phase T encounters.jsonl.`,
'- Screenshots and scoped traces for every item are retained under C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/question-variations-2026-10-17/screenshots and traces, so every later-adjudicated failure has its original evidence. Exact per-item paths are in CSV/JSON. The Playwright HTML report records group execution only.',
'',
'Original Phase T raw artifacts: C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/question-variations-2026-10-17. Application code and facts were not fixed; nothing was deployed.',
''].join('\n'));
console.log(JSON.stringify(metadata,null,2));
