import fs from 'node:fs';
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-followup-2026-10-17/raw';
const rows=fs.readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${raw}/${f}`)));
const cohort=process.argv[2],group=process.argv[3];
const selected=rows.filter(r=>(!cohort||r.cohort===cohort)&&(!group||r.groupId===group)).sort((a,b)=>a.testId.localeCompare(b.testId));
console.log(selected.map(r=>JSON.stringify({id:r.testId,question:r.question,setup:r.setupTurns.map(t=>({q:t.question,a:t.finalResponse})),answer:r.finalResponse,execution:r.httpStatus===200&&r.provider==='navigator'&&r.uiApiMatch&&r.correlationMatched?'OK':{outcome:r.outcome,reason:r.reason}})).join('\n'));
console.log('rows',selected.length,'total',rows.length);
