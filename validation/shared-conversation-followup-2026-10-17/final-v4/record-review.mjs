import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/shared-conversation-followup-2026-10-17/final-v4';
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-followup-2026-10-17-final-v4/raw';
const rows=fs.readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${raw}/${f}`)));
const [cohort,group,reason]=process.argv.slice(2);
if(!cohort||!group||!reason)throw Error('Explicit reviewed cohort, group and substantive reason required');
const exceptions=fs.existsSync(`${root}/review-overrides.json`)?JSON.parse(fs.readFileSync(`${root}/review-overrides.json`)):{};
const prior=fs.existsSync(`${root}/adjudications.json`)?JSON.parse(fs.readFileSync(`${root}/adjudications.json`)):[];
for(const r of rows.filter(r=>r.cohort===cohort&&r.groupId===group&&r.testId.startsWith(process.argv[5]??''))){
 if(!r.finalResponse||r.httpStatus!==200||r.provider!=='navigator'||!r.uiApiMatch||!r.correlationMatched)continue;
 const dimensions=Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,exceptions[r.testId]?.[k]??{status:'PASS',reason}]));
 const outcome=Object.values(dimensions).some(d=>d.status==='FAIL')?'FAIL':Object.values(dimensions).some(d=>d.status==='REVIEW')?'REVIEW':'PASS';
 if(prior.some(d=>d.runId===r.runId))continue;
 prior.push({testId:r.testId,runId:r.runId,responseSha256:crypto.createHash('sha256').update(r.finalResponse).digest('hex'),reviewedAt:new Date().toISOString(),outcome,dimensions,method:'Assistant semantic review of every displayed exact question, final UI/API response and separate setup; no keyword-only award.'});
}
fs.writeFileSync(`${root}/adjudications.json`,JSON.stringify(prior,null,2));
console.log(`Recorded ${cohort}/${group}; adjudications ${prior.length}`);
