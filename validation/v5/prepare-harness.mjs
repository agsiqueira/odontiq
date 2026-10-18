import fs from 'node:fs';
import crypto from 'node:crypto';
const phase='C:/240 - odontIQ/odontiq-phase-t';
const read=p=>fs.readFileSync(`${phase}/${p}`,'utf8');
const source=read('tests/browser/patient-shared-conversation-v4-continuation.spec.ts');
let spec=source.replaceAll('http://localhost:3000','http://localhost:3001').replaceAll('Synthetic 340-question variation study','Synthetic frozen V5 546-item verification').replaceAll('execution-blocker-continuation.json','v5-execution-blocker.json');
spec=spec.replace("console.log(`VARIATION", "console.log(`V5_VARIATION");
fs.writeFileSync(`${phase}/tests/browser/patient-v5-verification.spec.ts`,spec,{flag:'wx'});
const setup=read('tests/auth/global.setup.ts').replace('import { clerkAuthStatePath } from "../../src/config/authState.js";','const clerkAuthStatePath = path.resolve("playwright/.clerk/v5-user.json");');
fs.writeFileSync(`${phase}/tests/auth/v5.global.setup.ts`,setup,{flag:'wx'});
const config=read('playwright.shared-v4-continuation.config.ts')
 .replace("import { clerkAuthStatePath } from './src/config/authState.js';", "import path from 'node:path';\nconst clerkAuthStatePath=path.resolve('playwright/.clerk/v5-user.json');")
 .replace('patient-shared-conversation-v4-continuation','patient-v5-verification')
 .replace('global\\.setup','v5\\.global\\.setup')
 .replaceAll('shared-conversation-followup-2026-10-17/playwright-v4-continuation','odontiq-v5-2026-10-17/playwright')
 .replaceAll('shared-conversation-followup-2026-10-17-v4-continuation-runner','odontiq-v5-2026-10-17-runner');
if(!config.includes('v5\\.global\\.setup'))throw Error('Isolated auth setup config not selected');
fs.writeFileSync(`${phase}/playwright.v5.config.ts`,config,{flag:'wx'});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['tests/browser/patient-v5-verification.spec.ts','tests/auth/v5.global.setup.ts','playwright.v5.config.ts'];
fs.writeFileSync('validation/v5/harness-configuration.json',JSON.stringify({createdAt:new Date().toISOString(),baseUrl:'http://localhost:3001',workers:1,browserRetries:0,originalV4HarnessUnchanged:true,changes:['Dedicated localhost port3001 for isolated V5 server','Separate auth setup/state, traces, reports and raw results','Same recorder, setup referent checks, UI/API/request correlation and student question strings','Real attempts retained on interruption; only unexecuted placeholders eligible for continuation','No semantic browser retries; bounded upstream gateway attempts occur inside provider and are recorded separately'],files:files.map(p=>({path:`${phase}/${p}`,sha256:sha(read(p))})),originalV4SourceSha256:sha(source)},null,2));
fs.copyFileSync('validation/shared-conversation-followup-2026-10-17/final-v4/run-inventory.json','validation/v5/run-inventory.json');
console.log('Isolated V5 live harness prepared; exact546-item V4 inventory copied.');
