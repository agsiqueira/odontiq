import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root='validation/shared-conversation-followup-2026-10-17';
const old='validation/shared-conversation-repair-2026-10-17';
const original=JSON.parse(fs.readFileSync(`${old}/automated-checks.json`));
const additional=JSON.parse(fs.readFileSync(`${old}/additional-clinical-checks-final.json`)).map(r=>r.name);
const names=['validateSharedConversationFollowup','validateCase01FacultyFacts',...additional,'validateCase01PenicillinAllergy','validateCase03AllergyResponse'];
const checks=[...names.filter(name=>fs.existsSync(`scripts/${name}.ts`)).map(name=>({name,command:['node','node_modules/jiti/lib/jiti-cli.mjs',`scripts/${name}.ts`]})),...original];
const results=[];
for(const check of checks){
 const args=check.command.slice(1);
 if(check.name==='lint')args.push('src/lib/patientCanonicalAssertions.ts','scripts/validateSharedConversationFollowup.ts');
 const start=Date.now();
 const r=spawnSync(process.execPath,args,{encoding:'utf8',env:{...process.env,ODONTIQ_VALIDATION_OUTPUT:`${root}/deterministic-contract-replay.json`},maxBuffer:8e6});
 results.push({name:check.name,command:[process.execPath,...args],startedAt:new Date(start).toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message});
 fs.writeFileSync(`${root}/automated-checks.json`,JSON.stringify(results,null,2));
 console.log(`${check.name}: ${r.status===0?'PASS':'FAIL'} (${Date.now()-start}ms)`);
}
if(results.some(r=>r.exitCode!==0))process.exitCode=1;
