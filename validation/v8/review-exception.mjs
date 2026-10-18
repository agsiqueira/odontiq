import fs from 'node:fs';
const [id,dimension,status,reason]=process.argv.slice(2);
if(!id||!['factualCorrectness','completeness','relevance','leakage'].includes(dimension)||!['FAIL','REVIEW'].includes(status)||!reason)throw Error('Explicit inspected item, dimension, non-pass status and reason required');
const path='validation/v8/review-overrides.json';
const data=JSON.parse(fs.readFileSync(path));
data[id]={...data[id],[dimension]:{status,reason}};
fs.writeFileSync(path,JSON.stringify(data,null,2));
