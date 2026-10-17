import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/shared-conversation-followup-2026-10-17/final-v4';
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-followup-2026-10-17-final-v4/raw';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const rows=fs.readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${raw}/${f}`)));
const turns=rows.flatMap(r=>r.setupTurns.map((t,i)=>({...t,testId:r.testId,caseId:r.caseId,cohort:r.cohort,encounterId:r.encounterId,runId:r.runId,setupTurnIndex:i,responseSha256:hash(t.finalResponse??'')})));
const key=t=>JSON.stringify([t.caseId,t.question,t.finalResponse]);
const variants=[...new Set(turns.map(key))].map(k=>({variantKey:k,...turns.find(t=>key(t)===k),occurrences:turns.filter(t=>key(t)===k).map(t=>`${t.testId}:${t.setupTurnIndex}`)}));
if(process.argv[2]!=='record'){
 console.log(variants.map(v=>JSON.stringify({case:v.caseId,q:v.question,a:v.finalResponse,count:v.occurrences.length,ids:v.occurrences})).join('\n'));
 console.log(`${turns.length} setup turns; ${variants.length} unique case/question/response variants`);
}else{
 const approvals=JSON.parse(fs.readFileSync(`${root}/setup-variant-reviews.json`));
 const assessed=turns.map(t=>{
  const review=approvals.find(r=>r.variantKey===key(t));
  if(!review)throw Error(`Setup variant not reviewed: ${key(t)}`);
  return {testId:t.testId,caseId:t.caseId,cohort:t.cohort,runId:t.runId,setupTurnIndex:t.setupTurnIndex,question:t.question,finalResponse:t.finalResponse,requestId:t.requestId,encounterId:t.encounterId,responseSha256:t.responseSha256,reviewedAt:review.reviewedAt,outcome:Object.values(review.dimensions).some(d=>d.status==='FAIL')?'FAIL':Object.values(review.dimensions).some(d=>d.status==='REVIEW')?'REVIEW':'PASS',dimensions:review.dimensions};
 });
 fs.writeFileSync(`${root}/setup-adjudications.json`,JSON.stringify(assessed,null,2));
 console.log(`${assessed.length} separately assessed setup turns`);
}
