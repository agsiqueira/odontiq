import fs from 'node:fs';
import crypto from 'node:crypto';
const phase='C:/240 - odontIQ/odontiq-phase-t',root='validation/v6';
const spec=fs.readFileSync(`${phase}/tests/browser/patient-v6-verification.spec.ts`,'utf8').replace("priorRows.filter(r=>r.encounterId!==null || (r.apiAttempts?.length??0)>0)","priorRows.filter(r=>(r.apiAttempts?.length??0)>0 || (r.setupTurns?.length??0)>0)");
const config=fs.readFileSync(`${phase}/playwright.v6.config.ts`,'utf8').replaceAll('patient-v6-verification','patient-v6-continuation');
fs.writeFileSync(`${phase}/tests/browser/patient-v6-continuation.spec.ts`,spec);fs.writeFileSync(`${phase}/playwright.v6-continuation.config.ts`,config);
fs.writeFileSync(`${root}/continuation-harness.json`,JSON.stringify({at:new Date().toISOString(),eligibleIds:['C03-G08-Q14'],browserRetries:0,maxAdditionalAttempts:1,files:['tests/browser/patient-v6-continuation.spec.ts','playwright.v6-continuation.config.ts'].map(p=>({path:`${phase}/${p}`,sha256:crypto.createHash('sha256').update(fs.readFileSync(`${phase}/${p}`)).digest('hex')}))},null,2));
