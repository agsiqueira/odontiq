import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root='validation/v5';
const original=JSON.parse(fs.readFileSync('validation/shared-conversation-followup-2026-10-17/final-v4/automated-checks.json'));
const checks=[{name:'next-typegen',command:['node','node_modules/next/dist/bin/next','typegen']},{name:'validateV5PatientRepair',command:['node','node_modules/jiti/lib/jiti-cli.mjs','scripts/validateV5PatientRepair.ts']},...original];
const results=[];
for(const check of checks){
 const args=check.command.slice(1);
 if(check.name==='lint')args.push('src/lib/ai/navigatorTransport.ts','src/lib/ai/navigatorProvider.ts','src/lib/ai/provider.ts','src/lib/persistence/services/patientQuestionService.ts','scripts/validateV5PatientRepair.ts');
 const started=Date.now();
 const r=spawnSync(process.execPath,args,{encoding:'utf8',env:{...process.env,ODONTIQ_FOLLOWUP_OUTPUT:root,ODONTIQ_VALIDATION_OUTPUT:`${root}/deterministic-contract-replay.json`},maxBuffer:8e6});
 results.push({name:check.name,command:[process.execPath,...args],startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,exitCode:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message});
 fs.writeFileSync(`${root}/automated-checks.json`,JSON.stringify(results,null,2));
 console.log(`${check.name}: ${r.status===0?'PASS':'FAIL'} (${Date.now()-started}ms)`);
}
if(results.some(r=>r.exitCode!==0))process.exitCode=1;
