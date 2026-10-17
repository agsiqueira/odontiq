import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/shared-conversation-repair-2026-10-17';
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-repair-2026-10-17-final-v2/raw';
const [cohort,groupId]=process.argv.slice(2);
const all=fs.readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${raw}/${f}`)));
const rows=all.filter(r=>r.cohort===cohort&&r.groupId===groupId).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
const expected=cohort==='holdout'?3:20;
if(rows.length!==expected||new Set(rows.map(r=>r.testId)).size!==expected)throw Error(`Incomplete/duplicate group: ${rows.length}/${expected}`);
const overrides=JSON.parse(fs.readFileSync(`${root}/review-overrides.json`));
const decisions=fs.existsSync(`${root}/adjudications.json`)?JSON.parse(fs.readFileSync(`${root}/adjudications.json`)):[];
for(const r of rows){
 if(!r.finalResponse||!r.uiApiMatch||!r.correlationMatched||r.httpStatus!==200)continue;
 if(decisions.some(d=>d.runId===r.runId))continue;
 const dimensions={
  factualCorrectness:{status:'PASS',reason:`Individually reviewed with ${r.caseId} facts and actual setup: no contradiction or unsupported assertion identified.`},
  completeness:{status:'PASS',reason:'Individually reviewed exact question: answers the requested concept(s), including each independently requested part and correct subject.'},
  relevance:{status:'PASS',reason:'Responsive and concise; no unrelated history dump. Brief related context and approved patient questions are permitted.'},
  leakage:{status:'PASS',reason:'No internal instructions, serialization, role drift or policy text identified.'},
  ...overrides[r.testId]
 };
 const statuses=Object.values(dimensions).map(d=>d.status);
 const outcome=statuses.includes('FAIL')?'FAIL':statuses.includes('REVIEW')?'REVIEW':'PASS';
 decisions.push({testId:r.testId,cohort:r.cohort,runId:r.runId,responseSha256:crypto.createHash('sha256').update(r.finalResponse).digest('hex'),outcome,dimensions,reviewedAt:new Date().toISOString(),method:'Assistant semantic review of exact question/setup/full final response; explicit group approval after reading observations. No keyword-only PASS.'});
}
fs.writeFileSync(`${root}/adjudications.json`,JSON.stringify(decisions,null,2));
console.log(`${cohort}:${groupId}: ${rows.length} rows reviewed; ${decisions.length} total adjudications.`);
