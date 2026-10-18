import fs from 'node:fs';
const [cohort,group,reason]=process.argv.slice(2);
if(!cohort||!group||!reason)throw Error('Explicit personally inspected group and timing reason required');
const root='validation/v6',raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/odontiq-v6-2026-10-17/raw';
const overrides=JSON.parse(fs.readFileSync(`${root}/review-overrides.json`));
const rows=fs.readdirSync(raw).filter(p=>p.endsWith('.json')).map(p=>JSON.parse(fs.readFileSync(`${raw}/${p}`))).filter(r=>r.cohort===cohort&&r.groupId===group);
for(const r of rows){if(r.caseId==='case-04'&&r.finalResponse?.includes('Do I need an antibiotic?'))overrides[r.testId]={...overrides[r.testId],relevance:{status:'FAIL',reason}};}
fs.writeFileSync(`${root}/review-overrides.json`,JSON.stringify(overrides,null,2));console.log({inspectedGroup:group,flagged:rows.filter(r=>overrides[r.testId]?.relevance?.status==='FAIL').map(r=>r.testId)});
