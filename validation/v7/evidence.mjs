import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/v7';
const privateRoot='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/odontiq-v7-2026-10-17';
const raw=`${privateRoot}/raw`;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const exists=p=>fs.existsSync(p);
const inventory=read(`${root}/run-inventory.json`).tests;
const baseline=read('validation/v6/results.json');
const gradingCorrections=exists(`${root}/baseline-grading-corrections.json`)?read(`${root}/baseline-grading-corrections.json`).corrections:[];
const parseErrors=[];
const attempts=(exists(raw)?fs.readdirSync(raw):[]).filter(f=>f.endsWith('.json')).flatMap(f=>{try{return [{...read(`${raw}/${f}`),privateRawPath:`${raw}/${f}`}];}catch(e){parseErrors.push({file:f,error:String(e)});return [];}}).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
const actual=r=>r.encounterId!==null||(r.apiAttempts?.length??0)>0;
const recoveryPolicy=exists(`${root}/infrastructure-recovery.json`)?read(`${root}/infrastructure-recovery.json`):{eligibleIds:[]};
// Only an explicitly documented pre-submission infrastructure error may select its first actual scored request.
// Every original encounter/error remains in all-recorded-attempts and first-attempt-outcomes.
const rows=inventory.flatMap(item=>{const candidates=attempts.filter(r=>r.testId===item.testId);const first=candidates.find(actual);const r=recoveryPolicy.eligibleIds.includes(item.testId)&&first?.errorStage==='fresh-encounter'&&!first.apiAttempts?.length&&!first.setupTurns?.length?(candidates.find(r=>r.apiAttempts?.length>0)??first):first;return r?[r]:[];});
const decisions=exists(`${root}/adjudications.json`)?read(`${root}/adjudications.json`):[];
const overrides=exists(`${root}/review-overrides.json`)?read(`${root}/review-overrides.json`):{};
const dims=['factualCorrectness','completeness','relevance','leakage'];
const statuses=['PASS','FAIL','REVIEW','ERROR','BLOCKED'];
const tally=a=>Object.fromEntries(statuses.map(s=>[s,a.filter(r=>r.outcome===s).length]));
const setupReviews=exists(`${root}/setup-variant-reviews.json`)?read(`${root}/setup-variant-reviews.json`):[];
const setupKey=(r,t)=>JSON.stringify([r.caseId,t.question,t.finalResponse]);
const clean=t=>{const {lastAttemptedTurn,...other}=t;return {...other,apiAttempts:(t.apiAttempts??[]).map(({syntheticDiagnostics,...a})=>a),...(lastAttemptedTurn?{lastAttemptedTurn:{question:lastAttemptedTurn.question,requestId:lastAttemptedTurn.requestId,httpStatus:lastAttemptedTurn.httpStatus,apiFinalResponse:lastAttemptedTurn.apiFinalResponse,error:lastAttemptedTurn.apiAttempts?.at(-1)?.error}}:{})};};
const action=process.argv[2]??'status';
const cohort=process.argv[3],group=process.argv[4],reason=process.argv[5],prefix=process.argv[6]??'';
if(action==='show'){
 const selected=rows.filter(r=>(!cohort||r.cohort===cohort)&&(!group||r.groupId===group));
 console.log(selected.map(r=>JSON.stringify({id:r.testId,q:r.question,setup:r.setupTurns.map(t=>({q:t.question,a:t.finalResponse})),a:r.finalResponse,execution:r.httpStatus===200&&r.provider==='navigator'&&r.uiApiMatch&&r.correlationMatched?'OK':{outcome:r.outcome,reason:r.reason},failureUiText:r.failureUiText})).join('\n'));
 console.log(JSON.stringify({selected:selected.length,planned:inventory.filter(r=>(!cohort||r.cohort===cohort)&&(!group||r.groupId===group)).length,totalReal:rows.length}));
}else if(action==='record'){
 if(!cohort||!group||!reason)throw Error('Explicit reviewed cohort/group/reason required');
 for(const r of rows.filter(r=>r.cohort===cohort&&r.groupId===group&&r.testId.startsWith(prefix))){
  if(!r.finalResponse||r.httpStatus!==200||r.provider!=='navigator'||!r.uiApiMatch||!r.correlationMatched||r.outcome==='ERROR')continue;
  if(decisions.some(d=>d.runId===r.runId))continue;
  const dimensions=Object.fromEntries(dims.map(k=>[k,overrides[r.testId]?.[k]??{status:'PASS',reason}]));
  const outcome=dims.some(k=>dimensions[k].status==='FAIL')?'FAIL':dims.some(k=>dimensions[k].status==='REVIEW')?'REVIEW':'PASS';
  decisions.push({testId:r.testId,runId:r.runId,responseSha256:sha(r.finalResponse),reviewedAt:new Date().toISOString(),outcome,dimensions,method:'Assistant review of each exact question, setup, actual final UI/API response and canonical case facts. No keyword-only or V4-label pass.'});
 }
 fs.writeFileSync(`${root}/adjudications.json`,JSON.stringify(decisions,null,2));
 console.log({reviewed:decisions.length,outcomes:tally(decisions)});
}else if(action==='setups'){
 const variants=new Map();
 for(const r of rows)for(const t of r.setupTurns){const key=setupKey(r,t);if(!setupReviews.some(s=>s.variantKey===key))variants.set(key,{variantKey:key,caseId:r.caseId,q:t.question,a:t.finalResponse});}
 console.log([...variants.values()].map(v=>JSON.stringify(v)).join('\n'));
 console.log({unreviewed:variants.size,successfulTurns:rows.reduce((n,r)=>n+r.setupTurns.length,0)});
}else if(action==='export'){
 const setupDecisions=[];
 const publicRows=inventory.map(item=>{
  const r=rows.find(r=>r.testId===item.testId);
  if(!r)return {...item,implementationVersion:'V7',outcome:'BLOCKED',reason:'Pending live execution; no real attempt yet.',finalResponse:null,setupTurns:[],dimensions:Object.fromEntries(dims.map(k=>[k,{status:'NOT_ASSESSED',reason:'Not executed.'}]))};
  const d=decisions.find(d=>d.runId===r.runId&&d.responseSha256===sha(r.finalResponse??''));
  const setups=r.setupTurns.map((t,i)=>{
   const v=setupReviews.find(s=>s.variantKey===setupKey(r,t));
   const assessment=v?{testId:r.testId,runId:r.runId,caseId:r.caseId,setupTurnIndex:i,question:t.question,finalResponse:t.finalResponse,responseSha256:sha(t.finalResponse),reviewedAt:v.reviewedAt,dimensions:v.dimensions,outcome:dims.some(k=>v.dimensions[k].status==='FAIL')?'FAIL':dims.some(k=>v.dimensions[k].status==='REVIEW')?'REVIEW':'PASS'}:null;
   if(assessment)setupDecisions.push(assessment);
   return {...clean(t),assessment};
  });
  return {...clean(r),implementationVersion:'V7',setupTurns:setups,setupOutcome:setups.length?(setups.some(t=>t.assessment?.outcome==='FAIL')?'FAIL':setups.some(t=>!t.assessment||t.assessment.outcome==='REVIEW')?'REVIEW':'PASS'):'NOT_APPLICABLE',outcome:r.finalResponse&&r.outcome!=='ERROR'?d?.outcome??'REVIEW':r.outcome,dimensions:d?.dimensions??Object.fromEntries(dims.map(k=>[k,{status:'NOT_ASSESSED',reason:r.finalResponse?'Awaiting individual semantic review.':r.reason}])),reason:d?Object.entries(d.dimensions).filter(([,v])=>v.status!=='PASS').map(([k,v])=>`${k}: ${v.reason}`).join('; ')||'Individually reviewed; correct, complete, relevant and no leakage.':r.reason,originalRecorderOutcome:r.outcome,allAttemptRunIds:attempts.filter(a=>a.testId===r.testId).map(a=>a.runId)};
 });
 const comparison=publicRows.map(r=>{const old=baseline.find(b=>b.testId===r.testId);const correction=gradingCorrections.find(c=>c.testId===r.testId);const corrected=correction?.correctedVerdict??old.outcome;const assessed=Boolean(r.encounterId)&&(!r.finalResponse||r.outcome==='ERROR'||decisions.some(d=>d.runId===r.runId));return {testId:r.testId,question:r.question,v6Outcome:old.outcome,v6CorrectedOutcome:corrected,v6GradingCorrectionReason:correction?.reason??null,v7Outcome:r.outcome,v6Response:old.finalResponse,v7Response:r.finalResponse,responseIdentical:old.finalResponse===r.finalResponse,v7Reason:r.reason,assessed,regressionFromV6Pass:old.outcome==='PASS'&&assessed&&r.outcome!=='PASS',regressionAgainstCorrectedV6:corrected==='PASS'&&assessed&&r.outcome!=='PASS',identicalTextBehavioralImprovementClaim:false};});
 const cohorts=[...new Set(inventory.map(r=>r.cohort))];
 const summary={generatedAt:new Date().toISOString(),planned:546,realAttempted:rows.length,delivered:rows.filter(r=>r.finalResponse).length,reviewed:decisions.length,rawRecords:attempts.length,counts:tally(publicRows),cohorts:Object.fromEntries(cohorts.map(c=>[c,{total:publicRows.filter(r=>r.cohort===c).length,outcomes:tally(publicRows.filter(r=>r.cohort===c))}])),v6Counts:tally(baseline),regressionsFromV6Pass:comparison.filter(c=>c.regressionFromV6Pass),unreviewedDelivered:publicRows.filter(r=>r.finalResponse&&dims.some(k=>r.dimensions[k].status==='NOT_ASSESSED')).map(r=>r.testId),unreviewedSetups:publicRows.flatMap(r=>r.setupTurns.filter(t=>!t.assessment).map(t=>({testId:r.testId,q:t.question,a:t.finalResponse}))),parseErrors};
 fs.writeFileSync(`${root}/results.json`,JSON.stringify(publicRows,null,2));
 fs.writeFileSync(`${root}/unresolved-items.json`,JSON.stringify(publicRows.filter(r=>r.outcome!=='PASS'),null,2));
 fs.writeFileSync(`${root}/comparison-v6.json`,JSON.stringify(comparison,null,2));
 fs.writeFileSync(`${root}/summary.json`,JSON.stringify(summary,null,2));
 fs.writeFileSync(`${root}/setup-adjudications.json`,JSON.stringify(setupDecisions,null,2));
 fs.writeFileSync(`${root}/all-recorded-attempts.json`,JSON.stringify(attempts.map(r=>({...clean(r),setupTurns:r.setupTurns.map(clean)})),null,2));
 const firstAttempts=inventory.flatMap(i=>{const r=attempts.find(a=>a.testId===i.testId&&actual(a));if(!r)return [];const d=decisions.find(d=>d.runId===r.runId);return [{testId:r.testId,question:r.question,setupTurns:r.setupTurns.map(t=>({question:t.question,response:t.finalResponse})),runId:r.runId,encounterId:r.encounterId,scoredSubmitted:Boolean(r.apiAttempts?.length),outcome:r.finalResponse?d?.outcome??'REVIEW':r.outcome,finalResponse:r.finalResponse,error:r.error,errorStage:r.errorStage,failureUiText:r.failureUiText,reason:d?Object.entries(d.dimensions).filter(([,v])=>v.status!=='PASS').map(([k,v])=>`${k}: ${v.reason}`).join('; ')||'Individually reviewed correct final response.':r.reason,screenshot:r.screenshot,trace:r.trace,selectedRunId:rows.find(a=>a.testId===i.testId)?.runId}];});
 fs.writeFileSync(`${root}/first-attempt-outcomes.json`,JSON.stringify({at:new Date().toISOString(),counts:tally(firstAttempts),items:firstAttempts},null,2));
 fs.writeFileSync(`${root}/raw-artifact-manifest.json`,JSON.stringify(attempts.map(r=>({testId:r.testId,runId:r.runId,path:r.privateRawPath,sha256:sha(fs.readFileSync(r.privateRawPath))})),null,2));
 const cell=v=>`"${String(v??'').replaceAll('"','""')}"`;
 const columns=['testId','cohort','caseId','groupId','question','setupTurns','finalResponse','outcome','reason','factualCorrectness','completeness','relevance','leakage','encounterId','requestId','provider','httpStatus','uiApiMatch','correlationMatched','runId','screenshot','trace'];
 fs.writeFileSync(`${root}/results.csv`,'\ufeff'+columns.join(',')+'\r\n'+publicRows.map(r=>columns.map(k=>cell(k==='setupTurns'?JSON.stringify(r.setupTurns):r.dimensions[k]?.status??r[k])).join(',')).join('\r\n')+'\r\n');
 const registry=new Map();
 if(exists(`${privateRoot}/encounters.jsonl`))for(const l of fs.readFileSync(`${privateRoot}/encounters.jsonl`,'utf8').trim().split('\n').filter(Boolean)){const e=JSON.parse(l);registry.set(e.encounterId,e);}
 fs.writeFileSync(`${root}/research-exclusion.json`,JSON.stringify({generatedAt:new Date().toISOString(),encounters:[...registry.values()],rule:'Synthetic V7 study encounters only; exclude from participant research.'},null,2));
 const providerAttempts=rows.flatMap(r=>[...r.setupTurns.map(t=>({...t,stage:'setup'})),...(r.errorStage==='setup'&&r.lastAttemptedTurn?[{...r.lastAttemptedTurn,stage:'failed-setup'}]:[]),{...r,stage:'scored'}].flatMap(t=>t.apiAttempts.flatMap(a=>['initialProviderAttempts','correctiveProviderAttempts'].flatMap(k=>(a.syntheticDiagnostics?.[k]??[]).map(p=>({testId:r.testId,encounterId:r.encounterId,requestId:a.requestId,stage:t.stage,generation:k,...p}))))));
 fs.writeFileSync(`${root}/provider-attempts.json`,JSON.stringify(providerAttempts,null,2));
 const generations=rows.flatMap(r=>[...r.setupTurns.map(t=>({...t,stage:'setup'})),{...r,stage:'scored'}].flatMap(t=>t.apiAttempts.flatMap(a=>{
  const d=a.syntheticDiagnostics;
  return d?[{testId:r.testId,encounterId:r.encounterId,requestId:a.requestId,stage:t.stage,initialKind:d.immediate?'immediate':'navigator',initialResponse:d.navigatorInitial,initialGuardRejection:d.initialRejection,correctiveResponse:d.navigatorCorrective,usedGroundedFallback:d.usedFallback,safeResponse:d.safeResponse,finalAPIResponse:a.finalResponse,finalUIResponse:t.finalResponse,privateRawPath:r.privateRawPath}]:[];
 })));
 fs.writeFileSync(`${root}/generation-attempts.json`,JSON.stringify(generations,null,2));
 fs.writeFileSync(`${root}/generation-summary.json`,JSON.stringify({turnsWithDiagnostics:generations.length,immediateTurns:generations.filter(g=>g.initialKind==='immediate').length,initialGuardRejections:generations.filter(g=>g.initialGuardRejection).length,correctiveGenerations:generations.filter(g=>g.correctiveResponse!==null&&g.correctiveResponse!==undefined).length,groundedFallbacks:generations.filter(g=>g.usedGroundedFallback).length,limit:'Guard flags and internal candidates are not delivered-response semantic judgments. Failed API calls without diagnostics remain in raw error records and the provider HTTP log.'},null,2));
 console.log({realAttempted:rows.length,reviewed:decisions.length,counts:summary.counts,unreviewedSetups:summary.unreviewedSetups.length});
}else{
 const freeze=read(`${root}/implementation-freeze.json`);
 const changed=Object.entries(freeze.files).filter(([p,h])=>sha(fs.readFileSync(p))!==h).map(([p])=>p);
 const copiedV4Changed=read(`${root}/baseline-evidence-manifest.json`).filter(f=>sha(fs.readFileSync(f.path))!==f.sha256).map(f=>f.path);
 const status={at:new Date().toISOString(),commit:freeze.commit,changedFrozenFiles:changed,copiedV4Changed,realAttempted:rows.length,recorded:attempts.length,reviewed:decisions.length,outcomes:tally(decisions),errors:rows.filter(r=>!r.finalResponse).map(r=>({id:r.testId,outcome:r.outcome,reason:r.reason})),uiApi:{delivered:rows.filter(r=>r.finalResponse).length,mismatches:rows.filter(r=>r.finalResponse&&(!r.uiApiMatch||r.finalResponse!==r.apiFinalResponse||!r.correlationMatched)).map(r=>r.testId)},latest:[...rows].sort((a,b)=>a.startedAt.localeCompare(b.startedAt)).slice(-1).map(r=>({id:r.testId,at:r.startedAt})),parseErrors};
 fs.writeFileSync(`${root}/current-state.json`,JSON.stringify(status,null,2));
 console.log({...status,errors:status.errors.length});
 if(changed.length||copiedV4Changed.length)process.exitCode=1;
}
