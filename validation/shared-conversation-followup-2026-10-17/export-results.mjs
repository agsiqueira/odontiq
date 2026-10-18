import fs from 'node:fs';
import crypto from 'node:crypto';
const out='validation/shared-conversation-followup-2026-10-17';
const phase='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports';
const root=`${phase}/shared-conversation-followup-2026-10-17`;
const read=p=>JSON.parse(fs.readFileSync(p));
const inventory=read(`${out}/run-inventory.json`),decisions=fs.existsSync(`${out}/adjudications.json`)?read(`${out}/adjudications.json`):[];
const setupDecisions=fs.existsSync(`${out}/setup-adjudications.json`)?read(`${out}/setup-adjudications.json`):[];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const attempts=fs.readdirSync(`${root}/raw`).filter(f=>f.endsWith('.json')).map(f=>({...read(`${root}/raw/${f}`),privateRawPath:`${root}/raw/${f}`})).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
const clean=t=>({...t,apiAttempts:(t.apiAttempts??[]).map(({syntheticDiagnostics,...a})=>a)});
const notAssessed=reason=>Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,{status:'NOT_ASSESSED',reason}]));
const rows=inventory.tests.map(item=>{
 const candidates=attempts.filter(r=>r.testId===item.testId),r=candidates[0]; // First attempt is never silently replaced by a later pass.
 if(!r)return {...item,outcome:'BLOCKED',reason:'Not executed.',dimensions:notAssessed('Not executed.'),finalResponse:null};
 const d=decisions.find(d=>d.runId===r.runId&&d.responseSha256===hash(r.finalResponse??''));
 const assessedSetups=r.setupTurns.map((t,i)=>({...clean(t),assessment:setupDecisions.find(d=>d.runId===r.runId&&d.setupTurnIndex===i&&d.responseSha256===hash(t.finalResponse??''))??null}));
 return {...clean(r),implementationVersion:'followup-v3',setupTurns:assessedSetups,setupOutcome:assessedSetups.length?(assessedSetups.some(t=>t.assessment?.outcome==='FAIL')?'FAIL':assessedSetups.some(t=>!t.assessment||t.assessment.outcome==='REVIEW')?'REVIEW':'PASS'):'NOT_APPLICABLE',setupReason:assessedSetups.filter(t=>t.assessment?.outcome!=='PASS').map(t=>t.assessment?Object.values(t.assessment.dimensions).filter(d=>d.status!=='PASS').map(d=>d.reason).join('; '):'Awaiting setup review.').join('; '),outcome:r.finalResponse?d?.outcome??'REVIEW':r.outcome,dimensions:d?.dimensions??notAssessed(r.finalResponse?'Awaiting individual review.':r.reason),reason:d?Object.entries(d.dimensions).filter(([,v])=>v.status!=='PASS').map(([k,v])=>`${k}: ${v.reason}`).join('; ')||'Individually reviewed; factually correct, complete, relevant and no leakage.':r.reason,originalRecorderOutcome:r.outcome,privateRawPath:r.privateRawPath,allAttemptRunIds:candidates.map(r=>r.runId)};
});
const statuses=['PASS','FAIL','REVIEW','ERROR','BLOCKED'];
const tally=rows=>Object.fromEntries(statuses.map(s=>[s,rows.filter(r=>r.outcome===s).length]));
const columns=['testId','cohort','caseId','groupId','question','setupTurns','setupOutcome','setupReason','finalResponse','outcome','reason','factualCorrectness','factualCorrectnessReason','completeness','completenessReason','relevance','relevanceReason','leakage','leakageReason','encounterId','requestId','provider','httpStatus','uiApiMatch','correlationMatched','elapsedMs','runId','attempt','screenshot','trace','privateRawPath'];
const cell=v=>`"${String(v??'').replaceAll('"','""')}"`;
const cohorts=['primary','pain-context','former-holdout-regression','targeted-live','fresh-holdout'];
const summary={generatedAt:new Date().toISOString(),executionComplete:inventory.tests.every(i=>attempts.some(r=>r.testId===i.testId)),planned:inventory.tests.length,recordedAttempts:attempts.length,cohorts:{}};
for(const cohort of cohorts){
 const a=rows.filter(r=>r.cohort===cohort);
 fs.writeFileSync(`${out}/${cohort}-results.json`,JSON.stringify(a,null,2));
 fs.writeFileSync(`${out}/${cohort}-results.csv`,'\ufeff'+columns.join(',')+'\r\n'+a.map(r=>columns.map(k=>cell(k==='setupTurns'?JSON.stringify(r.setupTurns):k.endsWith('Reason')&&r.dimensions[k.slice(0,-6)]?r.dimensions[k.slice(0,-6)].reason:r.dimensions[k]?.status??r[k])).join(',')).join('\r\n')+'\r\n');
 summary.cohorts[cohort]={total:a.length,outcomes:tally(a),dimensions:Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,Object.fromEntries(['PASS','FAIL','REVIEW','NOT_ASSESSED'].map(s=>[s,a.filter(r=>r.dimensions[k]?.status===s).length]))])),byCase:Object.fromEntries([...new Set(a.map(r=>r.caseId))].map(c=>[c,tally(a.filter(r=>r.caseId===c))])),byGroup:Object.fromEntries([...new Set(a.map(r=>r.groupId))].map(g=>[g,tally(a.filter(r=>r.groupId===g))]))};
}
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2));
const turns=attempts.flatMap(r=>[...r.setupTurns.map(t=>({...t,testId:r.testId,scored:false})),{...r,scored:true}]);
const diags=turns.flatMap(t=>t.apiAttempts.map(a=>a.syntheticDiagnostics).filter(Boolean));
const percentile=(values,p)=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return a[Math.floor((a.length-1)*p)]??null;};
const stats=a=>({count:a.length,p50:percentile(a,.5),p90:percentile(a,.9),p95:percentile(a,.95)});
const old='validation/shared-conversation-repair-2026-10-17';
const priorRows=['primary','pain-context','holdout'].flatMap(c=>read(`${old}/${c}-results.json`));
fs.writeFileSync(`${out}/execution-metadata.json`,JSON.stringify({conversationTurns:turns.length,apiAttempts:turns.flatMap(t=>t.apiAttempts).length,providers:[...new Set(turns.map(t=>t.provider))],httpStatuses:[...new Set(turns.map(t=>t.httpStatus))],immediateTurns:diags.filter(d=>d.immediate).length,internalCorrectiveGenerations:diags.filter(d=>d.navigatorCorrective!==null&&d.navigatorCorrective!==undefined).length,internalFallbacks:diags.filter(d=>d.usedFallback).length,observedConversationGenerations:diags.filter(d=>!d.immediate).length+diags.filter(d=>d.navigatorCorrective!==null&&d.navigatorCorrective!==undefined).length,rateLimitAttempts:turns.flatMap(t=>t.apiAttempts).filter(a=>a.httpStatus===429).length,latencyMs:{method:'Browser client elapsed response time; observational sequential same-stack comparison; not controlled.',previousComparable411:stats(priorRows.map(r=>r.elapsedMs)),currentComparable411:stats(rows.filter(r=>['primary','pain-context','former-holdout-regression'].includes(r.cohort)).map(r=>r.elapsedMs)),currentAll:stats(rows.map(r=>r.elapsedMs)),byCohort:Object.fromEntries(cohorts.map(c=>[c,stats(rows.filter(r=>r.cohort===c).map(r=>r.elapsedMs))]))},generationCountLimit:'Excludes separate approved-patient-question classifier calls.',workerCount:1,automaticBrowserRetries:0,minimumSubmissionIntervalMs:1000,rawDirectory:`${root}/raw`},null,2));
fs.writeFileSync(`${out}/trace-index.json`,JSON.stringify(turns.map(t=>{const d=t.apiAttempts.at(-1)?.syntheticDiagnostics;return {testId:t.testId,scored:t.scored,question:t.question,requestId:t.requestId,encounterId:d?.encounterId??t.encounterId,interpretation:d?.interpretation,selectedFacts:d?.selectedFacts,requiredFacts:d?.requiredFacts,immediate:d?.immediate,initialRejection:d?.initialRejection,usedFallback:d?.usedFallback,correctiveGenerationPerformed:d?.navigatorCorrective!==undefined&&d?.navigatorCorrective!==null,presentationAssessment:d?.presentationAssessment};}),null,2));
const registry=new Map();
if(fs.existsSync(`${root}/encounters.jsonl`))for(const line of fs.readFileSync(`${root}/encounters.jsonl`,'utf8').trim().split('\n').filter(Boolean)){const e=JSON.parse(line);registry.set(e.encounterId,{...e,purpose:'Synthetic shared conversational follow-up; exclude from participant research',registrationSource:`${root}/encounters.jsonl`});}
const regStart=fs.existsSync(`${out}/regression-start.json`)?read(`${out}/regression-start.json`).startedAt:null;
if(regStart)for(const f of fs.readdirSync(`${phase}/runs`).filter(f=>f.endsWith('_research-exclusion.json'))){const e=read(`${phase}/runs/${f}`);if(e.createdAt>=regStart)registry.set(e.encounterId,{...e,registrationSource:`${phase}/runs/${f}`});}
fs.writeFileSync(`${out}/research-exclusion.json`,JSON.stringify({generatedAt:new Date().toISOString(),uniqueEncounterCount:registry.size,rule:'New encounters for this follow-up only; earlier registries retained separately.',encounters:[...registry.values()]},null,2));
fs.writeFileSync(`${out}/raw-artifact-manifest.json`,JSON.stringify(attempts.map(r=>({path:r.privateRawPath,sha256:hash(fs.readFileSync(r.privateRawPath)),runId:r.runId,testId:r.testId})),null,2));
fs.writeFileSync(`${out}/all-recorded-attempts.json`,JSON.stringify(attempts.map(r=>({...clean(r),setupTurns:r.setupTurns.map(clean)})),null,2));
console.log(Object.fromEntries(Object.entries(summary.cohorts).map(([k,v])=>[k,v.outcomes])));
