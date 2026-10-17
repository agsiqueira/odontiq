import fs from 'node:fs';
const root='validation/v5';
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/odontiq-v5-2026-10-17/raw';
const rows=fs.readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${raw}/${f}`)));
// Exact tuples personally inspected in the current V5 run. No pattern-based PASS.
const reviewed=[
 ['case-03','Do you have any children?','Yes, I have a young daughter.','Canonical young daughter establishes the child referent; no age, cohabitation, number of other children or clinic history invented.'],
 ['case-03',"I'm looking into dental care options for you and your daughter.","That's good to hear. I want to make sure we both have the best care.",'Natural acknowledgment and wish for care for the known parent/daughter after the child setup; no clinic history, cohabitation or scheduling arrangement asserted.'],
 ['case-02','What county do you live in?','Collier County.','Correct canonical county; establishes the residency-question referent without inventing household or address.'],
 ['case-02','Have you ever had Medicaid?','Yes, I had Medicaid, but I lost it within the past year.','Canonical prior coverage and loss within the past year; historical yes and referent established without invented reason/date.'],
 ['case-02','Have you ever had Medicaid?','Yeah, I had Medicaid before, but I lost it within the last year.','Canonical prior coverage and bounded within-last-year loss; no more precise date or loss reason.'],
 ['case-02','What happened to that coverage?','I lost Medicaid within the past year.','Correct coverage-loss event and bound; prior setup establishes Medicaid referent, no invented loss reason.'],
];
const prior=fs.existsSync(`${root}/setup-variant-reviews.json`)?JSON.parse(fs.readFileSync(`${root}/setup-variant-reviews.json`)):[];
for(const [caseId,q,a,reason] of reviewed){
 const variantKey=JSON.stringify([caseId,q,a]);
 if(prior.some(v=>v.variantKey===variantKey)||!rows.some(r=>r.caseId===caseId&&r.setupTurns.some(t=>t.question===q&&t.finalResponse===a)))continue;
 prior.push({variantKey,reviewedAt:new Date().toISOString(),dimensions:Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,{status:'PASS',reason}]))});
}
fs.writeFileSync(`${root}/setup-variant-reviews.json`,JSON.stringify(prior,null,2));
console.log({approvedExactVariants:prior.length});
