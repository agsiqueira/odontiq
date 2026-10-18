import fs from 'node:fs';
// All candidate questions, full setup context and final responses were individually read in question-timing-audit output.
// This corrects a historical blanket catalog exemption; it does not change application code or V5 originals.
const rows=JSON.parse(fs.readFileSync('validation/v5/results.json'));
const corrections=[];
for(const r of rows){
 const c4=r.caseId==='case-04'&&r.finalResponse?.includes('Do I need an antibiotic?');
 const c5=['C05-G17-Q10','C05-TARGET-1'].includes(r.testId);
 const identity=r.testId==='C03-G09-H01';
 if(!c4&&!c5&&!identity)continue;
 const reason=identity?`The exact question who's your dentist normally may request provider identity/name, but the case and response establish only an own-dentist relationship. The inventory expects status alone. Preserve completeness REVIEW for this question/expectation ambiguity, without inventing a name or silently selecting the narrower interpretation. This exact V5 row was separately inspected.`:c4?`The full fresh encounter contains only ${JSON.stringify(r.question)} and no prior setup. This is background inquiry/care-option screening or acknowledgment, not a provider-given pain-treatment or disposition/follow-up plan. The catalog requires painManagementOrDispositionDiscussed; catalog membership alone does not make the appended antibiotic question appropriately timed.`:`No substantive current-pain attribute is described in this fresh exchange. The catalog requires patientPainDescribed (location, quality, severity, timing, provoking/relieving factor or functional effect); generic tooth-pain mention or a financial preference is insufficient for the appended antibiotic request.`;
 corrections.push({testId:r.testId,question:r.question,context:r.setupTurns.map(t=>({question:t.question,response:t.finalResponse})),actualResponse:r.finalResponse,originalVerdict:r.outcome,correctedVerdict:identity?'REVIEW':'FAIL',dimension:identity?'completeness':'relevance',reason,behavioralImprovementClaim:false});
}
fs.writeFileSync('validation/v6/baseline-grading-corrections.json',JSON.stringify({at:new Date().toISOString(),method:'Assistant read each candidate exact question, full setup and delivered response against catalog event definitions and prerequisites. Original V5 artifacts unchanged. Same criteria apply to V6; no identical text is claimed as behavioral improvement.',corrections},null,2));
console.log({corrections:corrections.length});
