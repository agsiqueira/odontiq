import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const out='validation/shared-conversation-repair-2026-10-17';
const phase='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports';
const root=`${phase}/shared-conversation-repair-2026-10-17-final-v2`;
const inventory=JSON.parse(fs.readFileSync(`${out}/run-inventory.json`));
const decisions=JSON.parse(fs.readFileSync(`${out}/adjudications.json`));
const pilot=JSON.parse(fs.readFileSync(`${out}/pilot-v1/primary-results.json`));
const setupReviews=JSON.parse(fs.readFileSync(`${out}/setup-dimensional-review.json`));
const rawFiles=fs.readdirSync(`${root}/raw`).filter(f=>f.endsWith('.json'));
const attempts=rawFiles.map(f=>({...JSON.parse(fs.readFileSync(`${root}/raw/${f}`)),privateRawPath:`${root}/raw/${f}`})).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
if(!process.argv.includes('--partial')&&new Set(attempts.map(r=>r.testId)).size!==411)throw Error('Execution incomplete; no final export');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const cleanTurn=t=>{const {apiAttempts,...rest}=t;return {...rest,apiAttempts:(apiAttempts??[]).map(({syntheticDiagnostics,...api})=>api)};};
const notAssessed=reason=>Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,{status:'NOT_ASSESSED',reason}]));
const rows=inventory.tests.map(item=>{
 const candidates=attempts.filter(r=>r.testId===item.testId);
 const r=candidates.find(r=>r.finalResponse!==null&&r.uiApiMatch&&r.correlationMatched&&r.httpStatus===200)??candidates[0];
 if(!r)return {...item,outcome:'BLOCKED',reason:'Not executed yet; partial export only.',dimensions:notAssessed('Not executed.'),finalResponse:null,encounterId:null,requestId:null};
 const decision=decisions.find(d=>d.runId===r.runId&&d.responseSha256===hash(r.finalResponse??''));
 const {apiAttempts,setupTurns,...record}=r;
 const reviewedSetups=setupTurns.map((t,index)=>({...cleanTurn(t),assessment:setupReviews.find(s=>s.testId===r.testId&&s.setupTurnIndex===index&&s.question===t.question&&s.finalResponse===t.finalResponse)??null}));
 const setupProblems=reviewedSetups.filter(t=>t.assessment&&t.assessment.outcome!=='PASS');
 const outcome=!r.finalResponse?r.outcome:decision?.outcome??'REVIEW';
 const dimensions=decision?.dimensions??notAssessed(r.finalResponse?'Awaiting individual semantic review.':r.reason);
 return {...record,implementationVersion:'final-v2',executionKind:'Systematic complete rerun after preserved v1 pilot; not a selective semantic retry',priorVersionObservation:pilot.find(p=>p.testId===item.testId&&p.finalResponse)?{runId:pilot.find(p=>p.testId===item.testId).runId,outcome:pilot.find(p=>p.testId===item.testId).outcome,resultsFile:'pilot-v1/primary-results.json'}:null,setupTurns:reviewedSetups,setupOutcome:setupProblems.some(t=>t.assessment.outcome==='FAIL')?'FAIL':setupProblems.length?'REVIEW':setupTurns.length?'PASS':'NOT_APPLICABLE',setupReason:setupProblems.map(t=>Object.values(t.assessment.dimensions).filter(d=>d.status!=='PASS').map(d=>d.reason).join('; ')).join('; '),apiAttempts:apiAttempts.map(({syntheticDiagnostics,...api})=>api),outcome,dimensions,reason:decision?Object.entries(dimensions).filter(([,d])=>d.status!=='PASS').map(([k,d])=>`${k}: ${d.reason}`).join('; ')||'Correct, complete and relevant answer to the exact question; no leakage identified.':r.reason,originalRecorderOutcome:r.outcome,allAttemptRunIds:candidates.map(r=>r.runId),adjudication:decision?{method:decision.method,reviewedAt:decision.reviewedAt,responseSha256:decision.responseSha256}:null};
});
const tally=a=>a.reduce((s,r)=>(s[r.outcome]++,s),{PASS:0,FAIL:0,REVIEW:0,ERROR:0,BLOCKED:0});
const columns=['testId','cohort','caseId','groupId','question','setupTurns','setupOutcome','setupReason','finalResponse','outcome','reason','factualCorrectness','factualCorrectnessReason','completeness','completenessReason','relevance','relevanceReason','leakage','leakageReason','encounterId','requestId','provider','httpStatus','uiApiMatch','correlationMatched','implementationVersion','executionKind','priorVersionObservation','runId','attempt','screenshot','trace','privateRawPath'];
const csvCell=v=>`"${String(v??'').replaceAll('"','""')}"`;
for(const cohort of ['primary','pain-context','holdout']){
 const a=rows.filter(r=>r.cohort===cohort);
 fs.writeFileSync(`${out}/${cohort}-results.json`,JSON.stringify(a,null,2));
 const flat=a.map(r=>({...r,setupTurns:JSON.stringify(r.setupTurns??[]),priorVersionObservation:JSON.stringify(r.priorVersionObservation),...Object.fromEntries(Object.entries(r.dimensions).flatMap(([k,d])=>[[k,d.status],[`${k}Reason`,d.reason]]))}));
 fs.writeFileSync(`${out}/${cohort}-results.csv`,'\uFEFF'+[columns.map(csvCell).join(','),...flat.map(r=>columns.map(k=>csvCell(r[k])).join(','))].join('\r\n')+'\r\n');
}
const summary={generatedAt:new Date().toISOString(),executionComplete:new Set(attempts.map(r=>r.testId)).size===411,adjudicatedCount:decisions.length,cohorts:Object.fromEntries(['primary','pain-context','holdout'].map(c=>[c,tally(rows.filter(r=>r.cohort===c))])),byCase:Object.fromEntries(['primary','pain-context','holdout'].map(c=>[c,[...new Set(rows.filter(r=>r.cohort===c).map(r=>r.caseId))].map(caseId=>({caseId,...tally(rows.filter(r=>r.cohort===c&&r.caseId===caseId))}))])),byGroup:Object.fromEntries(['primary','pain-context','holdout'].map(c=>[c,[...new Set(rows.filter(r=>r.cohort===c).map(r=>r.groupId))].map(groupId=>({groupId,...tally(rows.filter(r=>r.cohort===c&&r.groupId===groupId))}))]))};
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2));
const turns=attempts.flatMap(r=>[...r.setupTurns.map(t=>({...t,scored:false,testId:r.testId})),{...r,scored:true}]);
const diagnostics=turns.flatMap(t=>t.apiAttempts.filter(a=>a.syntheticDiagnostics).map(a=>({testId:t.testId,scored:t.scored,question:t.question,encounterId:a.encounterId,requestId:a.requestId,provider:a.provider,httpStatus:a.httpStatus,interpretation:a.syntheticDiagnostics.interpretation,immediate:a.syntheticDiagnostics.immediate,correctiveRetryPerformed:a.syntheticDiagnostics.navigatorCorrective!==null,selectedFactIds:a.syntheticDiagnostics.selectedFacts.map(f=>f.id),requiredFactIds:a.syntheticDiagnostics.requiredFacts.map(f=>f.id),initialRejection:a.syntheticDiagnostics.initialRejection,usedFallback:a.syntheticDiagnostics.usedFallback,presentationAssessment:a.syntheticDiagnostics.presentationAssessment,privateRawPath:attempts.find(r=>r.testId===t.testId)?.privateRawPath})));
fs.writeFileSync(`${out}/trace-index.json`,JSON.stringify(diagnostics,null,2));
fs.writeFileSync(`${out}/execution-metadata.json`,JSON.stringify({conversationTurns:turns.filter(t=>t.requestId).length,apiAttempts:turns.reduce((s,t)=>s+t.apiAttempts.length,0),providers:[...new Set(turns.flatMap(t=>t.apiAttempts.map(a=>a.provider)))],httpStatuses:[...new Set(turns.flatMap(t=>t.apiAttempts.map(a=>a.httpStatus)))],internalCorrectiveRetries:diagnostics.filter(d=>d.correctiveRetryPerformed).length,internalFallbacks:diagnostics.filter(d=>d.usedFallback).length,observedConversationGenerationCalls:diagnostics.filter(d=>!d.immediate).length+diagnostics.filter(d=>d.correctiveRetryPerformed).length,modelCallCountingLimitation:'Conversation-generation calls only; separate patient-question classifier calls are not included.',rateLimitAttempts:turns.flatMap(t=>t.apiAttempts).filter(a=>a.httpStatus===429).length,diagnosticTurns:diagnostics.length,scoredFirstRuns:attempts.filter(r=>r.finalResponse).length,automaticBrowserRetries:0,workerCount:1,minimumSubmissionIntervalMs:1000,rawDirectory:`${root}/raw`,privateAuthenticationTraces:'Retained locally; do not publish.'},null,2));
const registry=new Map();
for(const folder of ['shared-conversation-repair-2026-10-17-final-v2','shared-conversation-repair-2026-10-17','shared-conversation-repair-2026-10-17-smoke','shared-conversation-repair-2026-10-17-smoke-scoped','shared-conversation-repair-2026-10-17-exact-repeats']){
 const f=`${phase}/${folder}/encounters.jsonl`;if(!fs.existsSync(f))continue;
 for(const line of fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean)){const e=JSON.parse(line);const prior=registry.get(e.encounterId);registry.set(e.encounterId,{...e,registrationSource:f,registrationEvents:(prior?.registrationEvents??0)+1,purpose:'Synthetic shared conversation repair validation; exclude from participant research'});}
}
const frozenAt=JSON.parse(fs.readFileSync(`${out}/implementation-freeze.json`)).frozenAt;
if(fs.existsSync(`${phase}/runs`))for(const file of fs.readdirSync(`${phase}/runs`).filter(f=>f.endsWith('_research-exclusion.json'))){const e=JSON.parse(fs.readFileSync(`${phase}/runs/${file}`));if(e.createdAt>=frozenAt)registry.set(e.encounterId,{...e,registrationSource:`${phase}/runs/${file}`,purpose:'Synthetic regression encounter for shared conversation repair; exclude from participant research'});}
fs.writeFileSync(`${out}/research-exclusion.json`,JSON.stringify({generatedAt:new Date().toISOString(),uniqueEncounterCount:registry.size,encounters:[...registry.values()]},null,2));
const everyRaw=[];
for(const folder of ['shared-conversation-repair-2026-10-17-final-v2','shared-conversation-repair-2026-10-17','shared-conversation-repair-2026-10-17-smoke','shared-conversation-repair-2026-10-17-smoke-scoped','shared-conversation-repair-2026-10-17-exact-repeats']){
 const rawPath=`${phase}/${folder}/raw`;if(!fs.existsSync(rawPath))continue;
 for(const file of fs.readdirSync(rawPath).filter(f=>f.endsWith('.json'))){const p=`${rawPath}/${file}`;everyRaw.push({path:p,sha256:hash(fs.readFileSync(p)),record:{...JSON.parse(fs.readFileSync(p)),artifactCohort:folder}});}
}
fs.writeFileSync(`${out}/raw-artifact-manifest.json`,JSON.stringify(everyRaw.map(({record,...m})=>m),null,2));
fs.writeFileSync(`${out}/all-recorded-attempts.json`,JSON.stringify(everyRaw.map(({record:r})=>({...cleanTurn(r),setupTurns:r.setupTurns.map(cleanTurn)})),null,2));
console.log(JSON.stringify(summary.cohorts));
