import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/v6',v5='C:/Users/agomesdesiqueira/.codex/worktrees/odontiq-v5/odontiq',phase='C:/240 - odontIQ/odontiq-phase-t';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Restore copied evidence after legacy checks accidentally used their historical default output paths.
const evidence=[];
function restore(dir){for(const e of fs.readdirSync(`${v5}/${dir}`,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())restore(p);else{const b=fs.readFileSync(`${v5}/${p}`);fs.copyFileSync(`${v5}/${p}`,p);evidence.push({path:p,sha256:sha(b)});}}}
for(const dir of ['validation/v5','validation/shared-conversation-followup-2026-10-17/final-v4','validation/shared-conversation-repair-2026-10-17'])restore(dir);
fs.writeFileSync(`${root}/baseline-evidence-manifest.json`,JSON.stringify(evidence,null,2));
const files=[['tests/browser/patient-v5-verification.spec.ts','tests/browser/patient-v6-verification.spec.ts'],['tests/auth/v5.global.setup.ts','tests/auth/v6.global.setup.ts'],['playwright.v5.config.ts','playwright.v6.config.ts']];
for(const [from,to] of files){const text=fs.readFileSync(`${phase}/${from}`,'utf8').replaceAll('V5','V6').replaceAll('v5','v6').replaceAll('3001','3002');fs.writeFileSync(`${phase}/${to}`,text);}
const harness={at:new Date().toISOString(),baseUrl:'http://localhost:3002',workers:1,browserRetries:0,files:files.map(([,p])=>({path:`${phase}/${p}`,sha256:sha(fs.readFileSync(`${phase}/${p}`))})),baselineUnchanged:true};
fs.writeFileSync(`${root}/harness-configuration.json`,JSON.stringify(harness,null,2));
fs.copyFileSync('validation/v5/run-inventory.json',`${root}/run-inventory.json`);
// New run uses the same incremental recorder and evidence shape; grading is freshly adjudicated.
for(const file of ['evidence.mjs','provider-log.mjs','verify_csv.py']){
 let t=fs.readFileSync(`validation/v5/${file}`,'utf8').replaceAll('V5','V6').replaceAll('v5','v6').replaceAll('3001','3002');
 if(file==='evidence.mjs')t=t.replace("const baseline=read('validation/shared-conversation-followup-2026-10-17/final-v4/results.json');","const baseline=read('validation/v5/results.json');");
 fs.writeFileSync(`${root}/${file}`,t);
}
fs.writeFileSync(`${root}/review-overrides.json`,'{}');
fs.writeFileSync(`${root}/setup-variant-reviews.json`,'[]');
fs.mkdirSync('dev-output',{recursive:true});
console.log({preservedEvidenceFiles:evidence.length,harnessFiles:harness.files.length});
