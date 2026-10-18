import fs from 'node:fs';
const env={...process.env};
const keys=['AI_PROVIDER','NAVIGATOR_MODEL','NAVIGATOR_BASE','NAVIGATOR_BASE_URL'];
for(const file of ['.env','.env.local'])for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z0-9_]+)=(.*)$/);
 if(m&&keys.includes(m[1]))env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}
const settings=Object.fromEntries(keys.filter(k=>env[k]).map(k=>[k,env[k]]));
const config={capturedAt:new Date().toISOString(),publicSettings:settings,method:'Allowlisted non-secret provider settings from current process and local env files; successful requests independently record navigator.',environment:'development',nextVersion:JSON.parse(fs.readFileSync('node_modules/next/package.json')).version,playwrightVersion:JSON.parse(fs.readFileSync('C:/240 - odontIQ/odontiq-phase-t/node_modules/@playwright/test/package.json')).version};
fs.writeFileSync('validation/shared-conversation-followup-2026-10-17/final-v4/provider-configuration.json',JSON.stringify(config,null,2));
console.log(config);
