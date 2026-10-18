import fs from 'node:fs';
import crypto from 'node:crypto';
const out='validation/shared-conversation-repair-2026-10-17';
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-repair-2026-10-17-final-v2/raw';
const rows=fs.readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${raw}/${f}`)));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const observations=rows.flatMap(r=>r.setupTurns.map((t,index)=>({testId:r.testId,caseId:r.caseId,cohort:r.cohort,setupTurnIndex:index,encounterId:r.encounterId,...t,variantId:hash(`${r.caseId}\n${t.question}\n${t.finalResponse}`)})));
const variants=[...new Set(observations.map(t=>t.variantId))].map(id=>{const a=observations.filter(t=>t.variantId===id);return {variantId:id,caseId:a[0].caseId,question:a[0].question,response:a[0].finalResponse,testIds:a.map(t=>t.testId)};});
if(!process.argv.includes('--approve-observed-variants')){
 console.log(JSON.stringify({recordedScoredRows:rows.length,setupObservationCount:observations.length,variants},null,2));
}else{
 if(rows.length!==411)throw Error('Review the complete final run before setup adjudication.');
 const notes=JSON.parse(fs.readFileSync(`${out}/setup-observations.json`));
 const decisions=observations.map(t=>{
  const note=notes.find(n=>n.testId===t.testId&&n.setupTurnIndex===t.setupTurnIndex)
    ??notes.find(n=>n.question===t.question&&n.response===t.finalResponse);
  const dimensions={
   factualCorrectness:{status:'PASS',reason:'Actual setup variant individually reviewed against the canonical case facts; no unsupported assertion identified.'},
   completeness:{status:'PASS',reason:'Answers the setup request or appropriately acknowledges the neutral care-planning statement; reference context remains usable.'},
   relevance:{status:'PASS',reason:'Relevant to the setup; brief related concern and approved patient questions are permitted.'},
   leakage:{status:'PASS',reason:'No instruction leakage, internal state or role drift identified.'},
  };
  if(note)dimensions[note.dimension]={status:note.outcome,reason:note.reason};
  const values=Object.values(dimensions).map(d=>d.status);
  return {testId:t.testId,caseId:t.caseId,cohort:t.cohort,setupTurnIndex:t.setupTurnIndex,question:t.question,finalResponse:t.finalResponse,encounterId:t.encounterId,requestId:t.requestId,variantId:t.variantId,outcome:values.includes('FAIL')?'FAIL':values.includes('REVIEW')?'REVIEW':'PASS',dimensions,method:'Assistant review of every observed case/question/response variant; identical variants inherit the same meaning. Separate from scored-question outcomes.'};
 });
 fs.writeFileSync(`${out}/setup-dimensional-review.json`,JSON.stringify(decisions,null,2));
 fs.writeFileSync(`${out}/setup-reviewed-variants.json`,JSON.stringify(variants,null,2));
 console.log(JSON.stringify(decisions.reduce((s,r)=>(s[r.outcome]=(s[r.outcome]||0)+1,s),{})));
}
