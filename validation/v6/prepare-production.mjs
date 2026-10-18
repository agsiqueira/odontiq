import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/v6',phase='C:/240 - odontIQ/odontiq-phase-t';
const tests=JSON.parse(fs.readFileSync(`${root}/run-inventory.json`)).tests;
const ids=['C01-G01-Q08','C03-G11-Q06','C03-G11-H01','C03-G11-H03','C05-TARGET-5','C03-G09-V4H2','C05-G16-V4H1','C03-G11-Q11','C01-G03-Q01','C02-G05-Q01','C04-G14-Q01','C05-G17-Q01'];
const smoke=ids.map(id=>{const t=tests.find(t=>t.testId===id);if(!t)throw Error(id);return {...t,cohort:'production-smoke'};});
for(const [i,caseId] of ['case-01','case-02','case-03','case-04','case-05'].entries()){
 smoke.push({testId:`PROD-CLOSURE-${i+1}`,caseId,cohort:'production-smoke',groupId:'CLOSURE',groupTitle:'Closure after clinical context',question:'Thank you for explaining that.',setupQuestions:['What brings you here today?'],expectedMeaning:'Brief acknowledgment without restarting history or an unsolicited question.',contextRequirement:'After actual chief complaint'});
}
fs.writeFileSync(`${root}/production-inventory.json`,JSON.stringify({tests:smoke},null,2));
const files=[['tests/browser/patient-v6-verification.spec.ts','tests/browser/patient-v6-production.spec.ts'],['tests/auth/v6.global.setup.ts','tests/auth/v6-production.global.setup.ts'],['playwright.v6.config.ts','playwright.v6-production.config.ts']];
for(const [a,b] of files){let t=fs.readFileSync(`${phase}/${a}`,'utf8').replaceAll('v6','v6-production').replaceAll('3002','3003');if(b.includes('config'))t=t.replace('patient-v6-production-verification','patient-v6-production');fs.writeFileSync(`${phase}/${b}`,t);}
fs.writeFileSync(`${root}/production-harness.json`,JSON.stringify({at:new Date().toISOString(),baseUrl:'http://localhost:3003',items:smoke.length,workers:1,browserRetries:0,files:files.map(([,p])=>({path:`${phase}/${p}`,sha256:crypto.createHash('sha256').update(fs.readFileSync(`${phase}/${p}`)).digest('hex')}))},null,2));
console.log({smokeItems:smoke.length});
