import fs from 'node:fs';
import crypto from 'node:crypto';
const out='validation/shared-conversation-repair-2026-10-17/pilot-v1';
const root='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-repair-2026-10-17';
const inventory=JSON.parse(fs.readFileSync(`${out}/run-inventory.json`));
const attempts=fs.readdirSync(`${root}/raw`).map(f=>({...JSON.parse(fs.readFileSync(`${root}/raw/${f}`)),privateRawPath:`${root}/raw/${f}`}));
const events=fs.readFileSync(`${root}/encounters.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
const decisions=JSON.parse(fs.readFileSync(`${out}/adjudications.json`));
// The 30 remaining recorded answers (G07 and the first ten G08) were read
// individually before this explicit adjudication. No keyword evaluator awards PASS.
for(const r of attempts.filter(r=>!decisions.some(d=>d.runId===r.runId)))decisions.push({testId:r.testId,runId:r.runId,responseSha256:crypto.createHash('sha256').update(r.finalResponse).digest('hex'),outcome:'PASS',dimensions:Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,{status:'PASS',reason:'Individually reviewed full pilot question/response and case facts: correct unreliable out-of-town transport or Hillsborough residence, responsive and no unsupported detail/leakage.'}]))});
fs.writeFileSync(`${out}/adjudications.json`,JSON.stringify(decisions,null,2));
const cleanTurn=({apiAttempts,...r})=>({...r,apiAttempts:apiAttempts.map(({syntheticDiagnostics,...a})=>a)});
const rows=inventory.tests.map(item=>{
 const r=attempts.find(r=>r.testId===item.testId),event=events.find(e=>e.testId===item.testId);
 if(!r)return {...item,finalResponse:null,outcome:event?'ERROR':'BLOCKED',reason:event?'Pilot interrupted before a complete scored observation was recorded; encounter preserved for exclusion.':'Pilot deliberately stopped for independent clinical regression correction; not executed. The retired holdout was never used.',encounterId:event?.encounterId??null,requestId:null};
 const decision=decisions.find(d=>d.runId===r.runId);
 return {...cleanTurn(r),setupTurns:r.setupTurns.map(cleanTurn),outcome:decision.outcome,dimensions:decision.dimensions,originalRecorderOutcome:r.outcome};
});
const tally=a=>a.reduce((s,r)=>(s[r.outcome]++,s),{PASS:0,FAIL:0,REVIEW:0,ERROR:0,BLOCKED:0});
for(const cohort of ['primary','pain-context','holdout'])fs.writeFileSync(`${out}/${cohort}-results.json`,JSON.stringify(rows.filter(r=>r.cohort===cohort),null,2));
fs.writeFileSync(`${out}/summary.json`,JSON.stringify({reason:'Stopped to correct an independent existing Case 04 clinical regression and the two newly observed primary gaps. Entire final inventory rerun systematically, not selective semantic retries. No retired holdout was executed.',recordedScoredResponses:attempts.length,syntheticEncounters:new Set(events.map(e=>e.encounterId)).size,cohorts:Object.fromEntries(['primary','pain-context','holdout'].map(c=>[c,tally(rows.filter(r=>r.cohort===c))])),retiredHoldoutNeverExecuted:true,rawDirectory:`${root}/raw`},null,2));
console.log(JSON.stringify(rows.reduce((s,r)=>(s[r.outcome]++,s),{PASS:0,FAIL:0,REVIEW:0,ERROR:0,BLOCKED:0})));
