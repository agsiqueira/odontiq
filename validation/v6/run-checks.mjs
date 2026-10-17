import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const prior=JSON.parse(fs.readFileSync('validation/v5/automated-checks.json'));
const commands=[{name:'validateV6PatientRepair',command:[process.execPath,'node_modules/jiti/lib/jiti-cli.mjs','scripts/validateV6PatientRepair.ts']},...prior];
const out=[];
process.env.ODONTIQ_FOLLOWUP_OUTPUT='validation/v6';
process.env.ODONTIQ_VALIDATION_OUTPUT='validation/v6/deterministic-contract-replay.json';
for(const c of commands){const start=Date.now();const args=c.command.slice(1);const r=spawnSync(process.execPath,args,{encoding:'utf8',env:process.env,maxBuffer:20e6});out.push({name:c.name,command:[process.execPath,...args],startedAt:new Date(start).toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,stdout:r.stdout,stderr:r.stderr});fs.writeFileSync('validation/v6/automated-checks.json',JSON.stringify(out,null,2));console.log(`${c.name}: ${r.status}`);}
if(out.some(r=>r.exitCode!==0))process.exitCode=1;
