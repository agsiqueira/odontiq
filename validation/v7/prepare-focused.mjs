import fs from 'node:fs';import crypto from 'node:crypto';
const root='validation/v7';const old=JSON.parse(fs.readFileSync('validation/v6/production-inventory.json'));const inv=JSON.parse(fs.readFileSync('validation/v6/run-inventory.json'));const tests=old.tests.map(r=>({...r,cohort:'v7-focused',groupId:'FOCUS'}));
for(const id of ['C03-TARGET-6','C04-TARGET-6','C05-TARGET-6','C03-G09-H01','C04-G12-Q02','C04-G13-Q01','C04-TARGET-2','C05-G17-Q10','C05-TARGET-1']){const r=inv.tests.find(r=>r.testId===id);if(!tests.some(t=>t.testId===id))tests.push({...r,cohort:'v7-focused',groupId:'FOCUS'});}
const extras=[
 ['C5-OPEN','case-05','What brings you in today?',[], 'Opening pain attributes permit antibiotic request; relevant canonical complaint.'],
 ['C5-LATER','case-05','What does your tooth pain feel like?', ['What is your name?'], 'Quality answer and eligible request; no turn threshold.'],
 ['C4-PLAN-PARA','case-04',"For now, take ibuprofen for relief; your next step is a dentist within three days.", [],'Actual pain/followup plan permits antibiotic-needed question.'],
 ['C4-PROMPT','case-04','Describe how your tooth feels.',[],'Answer pain; clinician symptom question is not a plan.'],
 ['C4-PLAN-THANKS','case-04','Thank you for explaining that.', ["We will manage your pain with ibuprofen and refer you to a dentist."], 'Acknowledge closure; do not restart.'],
 ['C3-CARE-PARA','case-03',"We are exploring clinics for both you and your daughter.",['Do you have any children?'],'Care-search acknowledgment and sourced preference, no child condition or attendance.'],
 ['C3-CHILD-CONDITION','case-03',"Does your daughter have dental problems?",['Do you have any children?'],'Child condition unknown, preserve family facts.'],
 ['C3-CHILD-PROVIDER','case-03',"Does your daughter have a regular dentist?",['Do you have any children?'],'Child provider unspecified; do not imply existing clinic.'],
 ['C1-SURGERY','case-01','We need to admit you and consult oral surgery.',[],'Extraction question eligible.'],
 ['C2-ABX','case-02','We will start antibiotic therapy now.',[],'Antibiotic-effect question eligible.'],
 ['C3-TEMP','case-03','I recommend acetaminophen for pain relief.',[],'Temporary-treatment followup question eligible under application contract.'],
 ['C3-ATTEND-PARA','case-03','How often do you visit your dentist?',[],'Existing dentist and appointment do not establish attendance frequency.']
];for(const [id,caseId,question,setupQuestions,expectedMeaning]of extras)tests.push({testId:`FOCUS-${id}`,caseId,question,setupQuestions,expectedMeaning,cohort:'v7-focused',groupId:'FOCUS',groupTitle:'V7 focused candidate verification',contextRequirement:'Exact setup required.'});
fs.writeFileSync(`${root}/focused-inventory.json`,JSON.stringify({tests},null,2));
const h='C:/240 - odontIQ/odontiq-phase-t';for(const [a,b]of [['tests/browser/patient-v6-production.spec.ts','tests/browser/patient-v7-focused.spec.ts'],['tests/auth/v6-production.global.setup.ts','tests/auth/v7-focused.global.setup.ts'],['playwright.v6-production.config.ts','playwright.v7-focused.config.ts']]){let s=fs.readFileSync(`${h}/${a}`,'utf8').replaceAll('v6-production','v7-focused').replaceAll('v6-2026','v7-focused-2026').replaceAll('localhost:3003','localhost:3004').replaceAll('V6','V7 candidate 1').replaceAll('validation/v6/production-inventory.json','validation/v7/focused-inventory.json');fs.writeFileSync(`${h}/${b}`,s);}console.log({focused:tests.length});
