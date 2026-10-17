import fs from 'node:fs';
const root='validation/shared-conversation-followup-2026-10-17/final-v4';
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-followup-2026-10-17-final-v4/raw';
// Exact case/question/response tuples personally inspected in this run. No keyword-based approval.
const approved=[
 ['case-01','How severe is your pain right now?','The painful tooth is my lower-left molar. The pain is eight out of ten now.','Canonical lower-left tooth and current eight-of-ten severity; answers current severity without reverting to initial severity.'],
 ...["I'm feeling pretty uncomfortable with this pain.","I'm feeling quite uncomfortable with this pain.","I'm feeling quite uncomfortable with the pain.","I'm pretty uncomfortable with this pain.","It's pretty uncomfortable, to be honest."].map(a=>['case-01','How are you feeling with the pain?',a,'Natural directly requested discomfort after established severe pain; no new concrete circumstance, complete and no leakage.']),
 ...['Yeah, I had Medicaid, but I lost it within the past year.','Yes, I had Medicaid, but I lost it within the past year.','Yes, I had Medicaid before, but I lost it within the past year.'].map(a=>['case-02','Have you ever had Medicaid?',a,'Prior Medicaid and loss within the past year are canonical; correct historical yes and current context, no invented reason or date.']),
 ['case-02','What happened to that coverage?','I lost Medicaid within the past year.','Correct canonical lost coverage and timing; no invented loss reason, complete and no leakage.'],
 ['case-02','Have you ever had Medicaid?','I lost Medicaid within the past year.','Loss of Medicaid correctly implies prior coverage and establishes the referent; canonical interval, no invented loss reason or leakage.'],
 ['case-02','What county do you live in?','Collier County.','Correct county; establishes the later location referent without inventing household/address.'],
 ['case-02','What county do you live in?','I live in Collier County.','Correct county and location referent, complete residence answer, no household or address invention.'],
];
const prior=fs.existsSync(`${root}/setup-variant-reviews.json`)?JSON.parse(fs.readFileSync(`${root}/setup-variant-reviews.json`)):[];
const rows=fs.readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${raw}/${f}`)));
for(const [c,q,a,reason] of approved){
 const variantKey=JSON.stringify([c,q,a]);
 if(prior.some(v=>v.variantKey===variantKey))continue;
 if(!rows.some(r=>r.caseId===c&&r.setupTurns.some(t=>t.question===q&&t.finalResponse===a)))continue;
 prior.push({variantKey,reviewedAt:new Date().toISOString(),dimensions:Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,{status:'PASS',reason}]))});
}
fs.writeFileSync(`${root}/setup-variant-reviews.json`,JSON.stringify(prior,null,2));
const unreviewed=rows.flatMap(r=>r.setupTurns.filter(t=>!prior.some(v=>v.variantKey===JSON.stringify([r.caseId,t.question,t.finalResponse]))).map(t=>({caseId:r.caseId,q:t.question,a:t.finalResponse})));
console.log(JSON.stringify({approvedVariants:prior.length,unreviewedVariants:[...new Map(unreviewed.map(v=>[JSON.stringify(v),v])).values()]}));
