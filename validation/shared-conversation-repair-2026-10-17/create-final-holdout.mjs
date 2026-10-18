import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='validation/shared-conversation-repair-2026-10-17';
const freeze=JSON.parse(fs.readFileSync(`${dir}/implementation-freeze.json`));
const original=JSON.parse(fs.readFileSync('validation/question-variations-2026-10-17/inventory.json'));
const groups=[
['G01','case-01',[],['Are your teeth insured under any plan at the moment?','Would we have an insurer to bill for your dentist visit?','You got insurance covering a dental appointment nowadays?']],
['G02','case-01',[],['What county would I put down as your residence?','You live over in Alachua, right?',"Where's your place, county-wise?"]],
['G03','case-01',[],['Would crossing county lines to get low-cost treatment be workable?','Could you make a longer trip for free dental care, and is your transportation dependable?','You willing to travel beyond Alachua if a dentist there charges less?']],
['G04','case-02',[],['Is there any active coverage we can bill for this care?','What plan insures you for a visit, if one does?','You still on Medicaid, or without any insurance these days?']],
['G05','case-02',['Have you ever had Medicaid?','What happened to that coverage?'],['The Medicaid you lost: how long back was that?','Has that coverage loss been in the past year?','Was Medicaid stopping within a year, or longer back?']],
['G06','case-02',['What county do you live in?'],['Does your residency count as established at this point?','Have you completed becoming an established resident there?','Your county residency established by now, and which county is home?']],
['G07','case-02',[],['Could you dependably show up in another town for a visit?','Would your ride out of town be something you can rely on?','Your transportation dependable when a clinic is beyond town, yes or no?']],
['G08','case-03',[],['For your local referral, what county are you based in?','Your residence is in which county at present?','You living over in Hillsborough, correct?']],
['G09','case-03',[],["Are you insured, and who's your dentist normally?","Do you already see a dental provider of your own, whether you're insured or not?","You got a dentist you usually see and insurance, or no coverage?"]],
['G10','case-03',['Do you have any children?'],['Is your daughter the one with Medicaid, or is that you?','What coverage is she signed up for?','That child has which insurance plan?']],
['G11','case-03',['Do you have any children?',"I'm looking into dental care options for you and your daughter."],['Would one office meeting both your dental needs be easier?','You would rather share a dental clinic with her than use separate ones?','Keeping both of you at one clinic sounds preferable to you?']],
['G12','case-04',[],["County-wise, where is your residence?","Which county would I search around your home?","You lives over in Duval, right?"]],
['G13','case-04',[],['Is there an insurance card we can use for your dental visit?','Who covers your dental care, if anyone?','You insured for treatment right now, or without coverage?']],
['G14','case-04',[],['Would you consider a fee worked out from income?','Is a clinic charging an amount adjusted to income acceptable?','You open to sliding-scale charges if we find dental care?']],
['G15','case-05',[],['If I search by your county of residence, which one would I enter?','What county do you stay in as your home?','You living over in Marion, is that right?']],
['G16','case-05',[],['Is an insurer available to cover a dental visit for you?','What dental plan, if any, is covering you currently?','Any insurance we could bill, or are you without it?']],
['G17','case-05',[],['Could you pay a couple of dollars toward care, even that little?','Is a free clinic what you prefer, and can you afford any charge at all?','A small dental fee is manageable for you or still not possible?']],
];
const holdout=groups.flatMap(([groupId,caseId,setupQuestions,questions])=>questions.map((question,index)=>({testId:`C${caseId.slice(-2)}-${groupId}-H${String(index+1).padStart(2,'0')}`,caseId,groupId,groupTitle:original.tests.find(t=>t.groupId===groupId).groupTitle,cohort:'holdout',question,setupQuestions,expectedMeaning:original.tests.find(t=>t.groupId===groupId).expectedMeaning,contextRequirement:'Separate setup turns shown in setupQuestions; evaluate actual question and all requested concepts against canonical facts.'})));
const retired=JSON.parse(fs.readFileSync(`${dir}/pilot-v1/holdout-inventory.json`));
if(holdout.some(t=>retired.tests.some(old=>old.question===t.question)))throw Error('Reused retired holdout wording');
if(holdout.length!==51||new Set(holdout.map(t=>t.testId)).size!==51)throw Error('Holdout count');
const createdAt=new Date().toISOString();
if(createdAt<=freeze.frozenAt)throw Error('Must create after final freeze');
fs.writeFileSync(`${dir}/holdout-inventory.json`,JSON.stringify({createdAt,implementationFrozenAt:freeze.frozenAt,version:'final-v2',untouched:true,tests:holdout},null,2));
fs.writeFileSync(`${dir}/run-inventory.json`,JSON.stringify({...original,version:'final-v2',holdoutCount:51,holdoutCreatedAt:createdAt,freezeSha256:crypto.createHash('sha256').update(fs.readFileSync(`${dir}/implementation-freeze.json`)).digest('hex'),tests:[...original.tests,...holdout]},null,2));
console.log(`Final freeze ${freeze.frozenAt}; new holdout created ${createdAt}; 51 new questions; all retired holdout wordings excluded.`);
