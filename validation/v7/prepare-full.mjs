import fs from 'node:fs';const root='validation/v7';const old='validation/v6';
for(const name of ['evidence.mjs','review-setup.mjs','review-exception.mjs','provider-log.mjs','verify_csv.py']){
let s=fs.readFileSync(`${old}/${name}`,'utf8').replaceAll('v6','v7').replaceAll('V6','V7').replaceAll('v5','v6').replaceAll('V5','V6');fs.writeFileSync(`${root}/${name}`,s);}
fs.copyFileSync(`${old}/run-inventory.json`,`${root}/run-inventory.json`);
const h='C:/240 - odontIQ/odontiq-phase-t';for(const [a,b]of [['tests/browser/patient-v6-verification.spec.ts','tests/browser/patient-v7-verification.spec.ts'],['tests/auth/v6.global.setup.ts','tests/auth/v7.global.setup.ts'],['playwright.v6.config.ts','playwright.v7.config.ts']])fs.writeFileSync(`${h}/${b}`,fs.readFileSync(`${h}/${a}`,'utf8').replaceAll('v6','v7').replaceAll('V6','V7').replaceAll('localhost:3002','localhost:3004'));
console.log('Separate V7 incremental collector and review tools prepared; full run has not started.');
