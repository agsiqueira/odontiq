import fs from 'node:fs';
const root='validation/v5';
const q="I'm looking into dental care options for you and your daughter.";
const reviews=JSON.parse(fs.readFileSync(`${root}/setup-variant-reviews.json`));
const safe=["That's good to hear. My daughter's dental health is important to me.","That's good to hear. We both need proper care.","That's good to hear, doctor. We both need it.","That's good to hear. Dental care is important for both of us.","That's good to hear. We both need it.","That's good to hear.","I appreciate that, doctor. My daughter's dental care is important to me."];
for(const a of [...safe,"That's good to hear. My daughter's teeth need more attention, I think."]){
 const variantKey=JSON.stringify(['case-03',q,a]);
 if(reviews.some(r=>r.variantKey===variantKey))continue;
 const bad=a.includes('teeth need more attention');
 const reason=bad?'The acknowledgment invents a current dental-care need for the daughter; canonical facts establish her Medicaid and shared-clinic preference, not her dental condition.':'Natural acknowledgment or general value of dental care in the parent/daughter context; no specific dental condition, established clinic, attendance or payment arrangement asserted.';
 reviews.push({variantKey,reviewedAt:new Date().toISOString(),dimensions:Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,{status:bad&&k==='factualCorrectness'?'FAIL':'PASS',reason}]))});
}
fs.writeFileSync(`${root}/setup-variant-reviews.json`,JSON.stringify(reviews,null,2));
const overrides=JSON.parse(fs.readFileSync(`${root}/review-overrides.json`));
overrides['C03-G11-Q06']={factualCorrectness:{status:'FAIL',reason:'The phrase "the same clinic as my daughter\'s" presupposes the daughter already has an established clinic. The case specifies only her Medicaid and a preference to share a clinic; neither setup establishes her existing provider.'}};
fs.writeFileSync(`${root}/review-overrides.json`,JSON.stringify(overrides,null,2));
