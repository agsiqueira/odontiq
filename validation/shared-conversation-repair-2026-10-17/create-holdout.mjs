import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='validation/shared-conversation-repair-2026-10-17';
const freeze=JSON.parse(fs.readFileSync(`${dir}/implementation-freeze.json`));
const original=JSON.parse(fs.readFileSync('validation/question-variations-2026-10-17/inventory.json'));
const groups=[
['G01','case-01',[],['Is there a dental plan helping with your bills?','Who covers the dentist bill — an insurer, or are you without a plan?','You got coverage if we book a dentist visit?']],
['G02','case-01',[],["For the referral address, what county is home?","Where's home these days?","You staying in Alachua County?"]],
['G03','case-01',[],['If a cheaper clinic were a county over, would you make the trip?','Could we count on you getting to an out-of-county dentist, even with this pain?','Is your way of reaching dental care dependable, and would you go farther for free treatment?']],
['G04','case-02',[],['Any insurer helping you pay for treatment these days?','Is Medicaid still covering you, or are you uninsured now?','You got a current plan for your care or none?']],
['G05','case-02',['Have you ever had Medicaid?','What happened to that coverage?'],['Did that coverage end during the past year?','How far back was it when you stopped being covered?','Medicaid going away — was that within twelve months?']],
['G06','case-02',['What county do you live in?'],['You live there, but is your county residency established?','Has establishing residency in Collier been completed?','For local eligibility, are you established as a resident yet?']],
['G07','case-02',[],['Getting to out-of-town appointments: dependable or a struggle?','Could I count on your transportation if the visit is beyond town?','You can reliably makes it to a dentist in a different town?']],
['G08','case-03',[],['For your home address, which Florida county applies?','Where do you reside these days, county-wise?','Your home county is Hillsborough, yes?']],
['G09','case-03',[],['Do you have a dentist already, and is an insurer paying for your care?','Who do you usually see for dental care, and what coverage have you got?','You uninsured but already have your own dentist, correct?']],
['G10','case-03',['Do you have any children?'],["Which plan is she covered under?","Your daughter gets Medicaid, even though you don't have coverage yourself?","Does your child have insurance, and is that Medicaid?"]],
['G11','case-03',['Do you have any children?',"I'm looking into dental care options for you and your daughter."],['One place for you two, rather than separate clinics — would you like that?','Would treating you together at one dental office be your preference?','You both wants care at the same place, right?']],
['G12','case-04',[],['For a nearby referral, which county is home to you?','Where are you residing at present?','Your home county Duval, is that correct?']],
['G13','case-04',[],['Does any plan currently cover your dental visits?','Before we choose a clinic, what insurance coverage have you got?','You without insurance for this treatment, right?']],
['G14','case-04',[],['Would fees tied to income be something you would consider?','A dentist adjusts the fee with your income — are you open to that?','You willing to consider income adjusted charges for a dental visit?']],
['G15','case-05',[],['Which county belongs on your home address for this referral?','Where are you residing these days, in terms of county?','Home for you is Marion County, correct?']],
['G16','case-05',[],['Any plan covering the dentist bill at present?','What coverage, if any, could we use to book your care?','You got insurance for treatment or you uninsured?']],
['G17','case-05',[],['Is there any room in your budget for even a small copayment?','Would you prefer no-cost care, and could you contribute anything at all?','A very small charge still too much, or could you pays it?']],
];
const holdout=groups.flatMap(([groupId,caseId,setupQuestions,questions])=>questions.map((question,index)=>({testId:`C${caseId.slice(-2)}-${groupId}-H${String(index+1).padStart(2,'0')}`,caseId,groupId,groupTitle:original.tests.find(t=>t.groupId===groupId).groupTitle,cohort:'holdout',question,setupQuestions,expectedMeaning:original.tests.find(t=>t.groupId===groupId).expectedMeaning,contextRequirement:'Separate setup turns shown in setupQuestions; evaluate all requested concepts against canonical facts.'})));
if(holdout.length!==51||new Set(holdout.map(t=>t.testId)).size!==51)throw Error('Holdout count');
const createdAt=new Date().toISOString();
if(createdAt<=freeze.frozenAt)throw Error('Must create after freeze');
const inventory={...original,holdoutCount:51,holdoutCreatedAt:createdAt,freezeSha256:crypto.createHash('sha256').update(fs.readFileSync(`${dir}/implementation-freeze.json`)).digest('hex'),tests:[...original.tests,...holdout]};
fs.writeFileSync(`${dir}/holdout-inventory.json`,JSON.stringify({createdAt,implementationFrozenAt:freeze.frozenAt,untouched:true,tests:holdout},null,2),{flag:'wx'});
fs.writeFileSync(`${dir}/run-inventory.json`,JSON.stringify(inventory,null,2),{flag:'wx'});
console.log(`Frozen ${freeze.frozenAt}; holdout created ${createdAt}; ${holdout.length} untouched questions, ${inventory.tests.length} total tests.`);
