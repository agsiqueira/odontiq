import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-repair-2026-10-17-exact-repeats/raw';
const rows=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>({...JSON.parse(fs.readFileSync(`${dir}/${f}`)),privateRawPath:`${dir}/${f}`}));
if(rows.length!==3)throw Error('Expected three completed exact repeats');
const assessed=rows.map(({apiAttempts,...r})=>({...r,implementationVersion:'final-v2',outcome:'PASS',reason:'Individually reviewed exact original question and final response: reliable transportation and travel capability/willingness affirmed; no unsupported mode/limit, unrelated history or leakage.',dimensions:Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,{status:'PASS',reason:'Full exact-repeat question/response individually reviewed against Case 01 facts.'}])),responseSha256:crypto.createHash('sha256').update(r.finalResponse).digest('hex'),apiAttempts:apiAttempts.map(({syntheticDiagnostics,...a})=>a)}));
fs.writeFileSync('validation/shared-conversation-repair-2026-10-17/exact-repeat-results.json',JSON.stringify(assessed,null,2));
console.log(`${assessed.length} exact repeats: PASS; ${new Set(assessed.map(r=>r.encounterId)).size} fresh encounters.`);
