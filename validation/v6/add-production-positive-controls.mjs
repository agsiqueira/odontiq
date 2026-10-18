import fs from 'node:fs';
const root='validation/v6',p=`${root}/production-inventory.json`,data=JSON.parse(fs.readFileSync(p));
for(const item of [
 {testId:'PROD-APPROPRIATE-C4-QUESTION',caseId:'case-04',question:"I'm referring you to a dentist for follow-up, and we will manage your pain with ibuprofen.",expectedMeaning:'Natural patient acknowledgment; catalog antibiotic question is eligible after this actual provider pain-treatment/follow-up plan.'},
 {testId:'PROD-APPROPRIATE-C5-QUESTION',caseId:'case-05',question:'What does your tooth pain feel like, and what makes it worse?',expectedMeaning:'Canonical current-pain attributes answer question; catalog antibiotic request is eligible only after substantive pain description.'}
])if(!data.tests.some(t=>t.testId===item.testId))data.tests.push({...item,cohort:'production-smoke',groupId:'APPROPRIATE-QUESTIONS',groupTitle:'Patient question positive controls',setupQuestions:[],contextRequirement:'Fresh encounter with actual triggering event in this turn'});
fs.writeFileSync(p,JSON.stringify(data,null,2));const h=JSON.parse(fs.readFileSync(`${root}/production-harness.json`));h.items=data.tests.length;fs.writeFileSync(`${root}/production-harness.json`,JSON.stringify(h,null,2));console.log({smokeItems:data.tests.length});
