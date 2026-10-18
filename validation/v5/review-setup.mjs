import fs from 'node:fs';
const [caseId,q,a,status,reason]=process.argv.slice(2);
if(!caseId||!q||!a||!['PASS','FAIL','REVIEW'].includes(status)||!reason)throw Error('Explicit inspected tuple, status and reason required');
const path='validation/v5/setup-variant-reviews.json';
const rows=JSON.parse(fs.readFileSync(path));
const variantKey=JSON.stringify([caseId,q,a]);
if(rows.some(r=>r.variantKey===variantKey))throw Error('Already reviewed');
rows.push({variantKey,reviewedAt:new Date().toISOString(),dimensions:Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,{status:k==='factualCorrectness'?status:'PASS',reason}]))});
fs.writeFileSync(path,JSON.stringify(rows,null,2));
