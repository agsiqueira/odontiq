import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='validation/v6',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const checks=JSON.parse(fs.readFileSync(`${root}/automated-checks.json`));
if(checks.length!==39||checks.some(c=>c.exitCode!==0))throw Error('39 passing checks required');
const prior=JSON.parse(fs.readFileSync('validation/v5/implementation-freeze.json'));
const paths=[...Object.keys(prior.files),'src/lib/patientConversationClosure.ts','scripts/validateV6PatientRepair.ts'];
const configuration={...prior.configuration,baseUrl:'http://localhost:3002',harness:JSON.parse(fs.readFileSync(`${root}/harness-configuration.json`)),production:{baseUrl:'http://localhost:3003',command:'node node_modules/next/dist/bin/next start --port 3003',mode:'NODE_ENV=production; optimized next build from same frozen source; separate .next production artifacts'}};
fs.writeFileSync(`${root}/implementation-freeze.json`,JSON.stringify({version:'V6',frozenAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineApplicationCommit:prior.commit,baselineEvidenceCommit:'8b1225367c047d9e8f2bd0c41f20fb81cf7b93cd',configuration,files:Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(p))]))},null,2));
// Adapt only verification infrastructure; V4/V5 helper files remain untouched.
let helper=fs.readFileSync(`${root}/evidence.mjs`,'utf8').replaceAll('comparison-v4','comparison-v5').replaceAll('v4Counts','v5Counts').replaceAll('v4Outcome','v5Outcome').replaceAll('v4Response','v5Response').replaceAll('v5Outcome:r.outcome','v6Outcome:r.outcome').replaceAll('v5Response:r.finalResponse','v6Response:r.finalResponse').replaceAll('v5Reason','v6Reason').replaceAll('v4-evidence-manifest.json','baseline-evidence-manifest.json');
fs.writeFileSync(`${root}/evidence.mjs`,helper);
console.log({commit:JSON.parse(fs.readFileSync(`${root}/implementation-freeze.json`)).commit,files:paths.length});
