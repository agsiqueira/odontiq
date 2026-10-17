import fs from 'node:fs';
const version=process.argv[2]??'v5';
const rows=JSON.parse(fs.readFileSync(`validation/${version}/results.json`));
for(const r of rows.filter(r=>r.finalResponse&&(/Do I need an antibiotic\?|Can I get an antibiotic\?/.test(r.finalResponse))))console.log(JSON.stringify({id:r.testId,case:r.caseId,q:r.question,context:r.setupTurns.map(t=>({q:t.question,a:t.finalResponse})),a:r.finalResponse,original:r.outcome}));
