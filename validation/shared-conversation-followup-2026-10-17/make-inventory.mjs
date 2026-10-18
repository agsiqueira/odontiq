import fs from 'node:fs';
const root='validation/shared-conversation-followup-2026-10-17';
const old='validation/shared-conversation-repair-2026-10-17';
const freeze=JSON.parse(fs.readFileSync(`${root}/implementation-freeze.json`));
const source=JSON.parse(fs.readFileSync(`${old}/run-inventory.json`));
const previous=source.tests.filter(r=>r.cohort!=='holdout').concat(JSON.parse(fs.readFileSync(`${old}/holdout-inventory.json`)).tests.map(r=>({...r,cohort:'former-holdout-regression'})));
const variants=[
 ['Is there any dental insurance in your name?','Are dental bills covered under a policy you hold?','For your own care, is there insurance to use?'],
 ['Which county is home base for you?','What county is your home located in?','Tell me the county where you reside.'],
 ['Would going across a county boundary for cheaper dental treatment work for you?','Is reaching an out-of-county dental office feasible for you?','Are trips beyond your home county possible if care costs less?'],
 ['Does a dental insurer currently cover you?','Is there a policy paying toward your dental treatment now?','Are you covered by any plan for dental appointments?'],
 ['How recently did your Medicaid coverage come to an end?','When did you stop being covered by Medicaid?','Has it been over a year since you lost Medicaid?'],
 ['Is Collier County your established place of residency?','Have you completed establishing residency where you live?','Do you already have established residency in Collier County?'],
 ['Could you count on transport to an out-of-town dentist?','How dependable is getting a ride beyond town for dental care?','Is out-of-town transportation consistently available to you?'],
 ['Is there insurance covering your own dental visits?','Do you personally have a dental insurance policy?','Would any insurer pay for your treatment?'],
 ['Is there a dental provider you normally return to?','Do you have an ongoing relationship with your own dentist?','Are you already a patient of a regular dental professional?'],
 ['What insurance covers your daughter?','Does she have Medicaid for her care?','Is your child covered under Medicaid?'],
 ['Would sharing a dental office with your daughter be preferable?','Do you like the idea of both of you receiving care in one clinic?','Would you rather arrange care at the same place for you two?'],
 ['What county do you call home?','In which county is your residence?','Which county are you based in at home?'],
 ['What insurer, if any, covers you for dental treatment?','Do you have a policy to consider while choosing a dental office?','Is your own dental care insured at present?'],
 ['Would an income-based dental fee be acceptable?','Are you open to care charged on a sliding scale?','Could a clinic with fees adjusted to income work for you?'],
 ['Where is home in terms of county?','What is the county of your home?','Which county do you reside in nowadays?'],
 ['Can a dental insurer help pay for your visit?','Is any dental coverage available under your name?','Do you currently hold insurance for dental care?'],
 ['Would even a small dental charge be affordable?','Is free dental care what you would prefer?','Could you pay a modest fee, or do you need care at no cost?'],
];
const fresh=variants.flatMap((questions,i)=>{
 const groupId=`G${String(i+1).padStart(2,'0')}`;
 const template=source.tests.find(r=>r.groupId===groupId&&r.cohort==='primary');
 return questions.map((question,j)=>({...template,testId:`${template.caseId.replace('case-','C')}-${groupId}-N${j+1}`,cohort:'fresh-holdout',question,setupQuestions:[9,10].includes(i)?['Do you have a daughter?']:[],primaryTestId:undefined}));
});
const existing=new Set([...source.tests,...JSON.parse(fs.readFileSync(`${old}/holdout-inventory.json`)).tests].map(r=>r.question.toLowerCase()));
if(fresh.length!==51||fresh.some(r=>existing.has(r.question.toLowerCase()))||new Set(fresh.map(r=>r.question)).size!==51)throw Error('Holdout not fresh/unique');
fs.writeFileSync(`${root}/fresh-holdout-inventory.json`,JSON.stringify({createdAt:new Date().toISOString(),implementationFrozenAt:freeze.frozenAt,rule:'Created after freeze; not used for implementation tuning before initial run.',tests:fresh},null,2));
const targeted=[];
for(let c=1;c<=5;c++){
 const caseId=`case-0${c}`;
 const questions=['Who do you live with?','Does your daughter live with you?','With whom do you share your home?',"I'm looking into dental care options for you.",'Thank you for explaining that.',"I'm looking into dental care options for you and your daughter."];
 questions.forEach((question,i)=>targeted.push({testId:`C0${c}-TARGET-${i+1}`,caseId,groupId:'TARGET',groupTitle:'Household boundary and neutral acknowledgement',cohort:'targeted-live',question,setupQuestions:[],expectedMeaning:i<3?'Household composition unspecified; do not disclose county as answer or invent cohabitation.':'Brief natural acknowledgement/emotion without concrete invented circumstances. Daughter statement is not evidence that any unspecified family fact is true.',contextRequirement:'None required.'}));
}
fs.writeFileSync(`${root}/run-inventory.json`,JSON.stringify({createdAt:new Date().toISOString(),implementationFrozenAt:freeze.frozenAt,tests:[...previous,...targeted,...fresh]},null,2));
console.log(`${previous.length} exact regression questions + ${targeted.length} targeted + ${fresh.length} fresh holdout = ${previous.length+targeted.length+fresh.length}`);
