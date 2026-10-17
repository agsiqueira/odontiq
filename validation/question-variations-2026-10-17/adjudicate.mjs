import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const out=path.resolve('validation/question-variations-2026-10-17');
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/question-variations-2026-10-17/raw';
const decisions=JSON.parse(readFileSync(path.join(out,'decisions.json'),'utf8'));
const rows=readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(path.join(raw,f),'utf8'))).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
const reviews={};
for(const decision of decisions){
 for(const id of decision.ids){
  if(reviews[id])throw Error(`Duplicate semantic decision ${id}`);
  const r=rows.find(r=>r.testId===id&&r.finalResponse!==null&&r.httpStatus===200&&r.uiApiMatch&&r.correlationMatched);if(!r)throw Error(`No recorded successful execution ${id}`);
  if(r.outcome==='ERROR'||r.outcome==='BLOCKED')throw Error(`Cannot override execution defect ${id}`);
  reviews[id]={runId:r.runId,responseSha256:createHash('sha256').update(r.finalResponse??'').digest('hex'),outcome:decision.outcome,reason:decision.reason,reviewedAt:new Date().toISOString()};
 }
}
writeFileSync(path.join(out,'adjudications.json'),JSON.stringify(reviews,null,2)+'\n');
console.log(`Saved ${Object.keys(reviews).length} explicit semantic adjudications; raw records unchanged.`);
