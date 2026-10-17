import fs from 'node:fs';
const root='validation/shared-conversation-followup-2026-10-17';
const out=`${root}/final-v4`;
const read=p=>JSON.parse(fs.readFileSync(p));
const freeze=read(`${out}/implementation-freeze.json`);
const previous=read(`${root}/run-inventory.json`).tests.map(t=>({...t,cohort:t.cohort==='fresh-holdout'?'v3-holdout-regression':t.cohort}));
const questions=[
 ['Would your dental visit be billed to an insurer?','Do you have coverage to put toward dental costs?','Is there dental insurance in your own name?'],
 ['Which county contains the place you call home?','In what county do you make your home?','Could you name your home county?'],
 ['If dental care were cheaper across the county line, could you get there?','Could you make a trip to a different county for affordable treatment?','Is another county within reach for lower-cost dental care?'],
 ['Do you have insurance benefits for your teeth right now?','Is your dental care currently paid for by an insurance plan?','Would you be using any insurance for this dental work?'],
 ['Did your Medicaid end within the past twelve months?','How long has it been since Medicaid stopped covering you?','Was your loss of Medicaid less than a year ago?'],
 ['Is your residency in Collier already established?','Would you describe your Collier County residency as established?','Have you established your residency in Collier County yet?'],
 ['Can you reliably get transportation for dental visits outside town?','Would travel outside town depend on uncertain transportation?','Can you always arrange transportation to a dentist in another town?'],
 ['For your treatment, is any insurance available?','Are your own dental expenses insured?','Do you carry a plan for your dental care?'],
 ['Is there a dentist you consider your usual provider?','Do you already see a dentist regularly?','Are you established with a dentist of your own?'],
 ['What kind of coverage does your daughter have?','Would Medicaid cover your daughter?','Is Medicaid your daughter\'s insurance?'],
 ['Would one dental practice for both you and your daughter suit you?','Would you prefer to receive care where your daughter could also be treated?','Should I seek a clinic that could see you as well as your daughter?'],
 ['What county should I use as your home county?','Which county do you currently call your home?','What is your county of residence at present?'],
 ['Would your own dental appointment go through insurance?','Is there insurance you could use when visiting a dentist?','Does any insurance plan cover you personally?'],
 ['Would you consider a dentist whose charges depend on income?','Would fees based on your earnings be an option?','Does a sliding-fee dental clinic sound acceptable?'],
 ['Which county is your current home in?','In which county have you made your home?','Could you tell me your current county of residence?'],
 ['Would an insurance policy contribute to your dental costs?','Is any part of your dental care covered by insurance?','Do you have insurance available for dental treatment today?'],
 ['Would you prefer a dental appointment with no fee?','Is a small charge manageable, or would free treatment be better?','Would you need free care instead of paying even a little?'],
];
const used=new Set(previous.map(t=>t.question.toLowerCase()));
const fresh=questions.flatMap((qs,i)=>{
 const groupId=`G${String(i+1).padStart(2,'0')}`;
 const template=previous.find(t=>t.groupId===groupId&&t.cohort==='primary');
 return qs.map((question,j)=>({...template,testId:`${template.caseId.replace('case-','C')}-${groupId}-V4H${j+1}`,cohort:'fresh-holdout',question,setupQuestions:[9,10].includes(i)?['Do you have a daughter?']:[],primaryTestId:undefined}));
});
if(fresh.length!==51||fresh.some(t=>used.has(t.question.toLowerCase()))||new Set(fresh.map(t=>t.question)).size!==51)throw Error('Holdout must be unique and fresh');
const meta={createdAt:new Date().toISOString(),implementationFrozenAt:freeze.frozenAt};
fs.writeFileSync(`${out}/fresh-holdout-inventory.json`,JSON.stringify({...meta,tests:fresh},null,2));
fs.writeFileSync(`${out}/run-inventory.json`,JSON.stringify({...meta,tests:[...previous,...fresh]},null,2));
console.log(JSON.stringify({regression:previous.length,fresh:fresh.length,total:previous.length+fresh.length}));
