import fs from 'node:fs';
import crypto from 'node:crypto';
const baseline='validation/shared-conversation-followup-2026-10-17/final-v4';
const unresolved=JSON.parse(fs.readFileSync(`${baseline}/unresolved-items.json`));
const diagnoses=unresolved.map(r=>{
 let kind,rootCause,resolution,limitation;
 if(r.outcome==='FAIL'){
  kind='application-defect';
  rootCause=r.testId==='C01-G03-V4H2'?'Trip/different-county phrasing missed the travel concept; an unsupported work-leave condition escaped the independent circumstance guard.':r.testId==='C03-G08-V4H3'?'Carrying a plan for dental care missed the insurance concept; unsupported last-attendance wording escaped the independent guard.':'Usual-provider/established-with/regularly phrasing missed the existing-dentist concept, selecting broad dental-history facts. The generic fallback was factually grounded but irrelevant; attendance gaps could also escape the guard.';
  resolution='Shared concept grammar, concept-scoped fallback, and provenance checks for work leave/attendance; no individual-question lookup or case-fact changes.';
 }else if(/unsupported family composition/.test(r.reason)){
  kind=r.outcome==='BLOCKED'?'application-defect-blocking-valid-setup':'erroneous-application-rejection';
  rootCause='PatientQuestionService.finalizeTurn called assertPatientFinalResponse(responseText) without case context. Empty default facts were interpreted as evidence of no daughter before the route case-aware callback could run.';
  resolution='Persistence now loads authoritative case facts for its final assembled-response check. Unknown family claims remain rejected for other cases. Required setup strings and scored questions remain unchanged.';
  limitation='The V4 502 response omitted internal candidates. The recorded unsupported-family rejection reason is erroneous for this canonical daughter; no claim is made that every suppressed generation was otherwise perfect.';
 }else if(/Navigator request failed/.test(r.reason)){
  kind='upstream-failure';rootCause='Recorded upstream HTTP 502, separate from application output rejection. Remote cause is not observable from the retained error.';
  resolution='At most one additional provider attempt for explicit HTTP 502/503/504, same request body, 250ms backoff within the existing overall timeout. Every attempt logged; no retry on auth, rate limit, general 500, network exception or application validation.';
 }else if(r.testId==='C01-G01-Q08'){
  kind='genuine-question-ambiguity';rootCause='The question may ask about lack of insurance or presuppose actual out-of-pocket payments. Canonical facts establish uninsured status and inability to afford extraction, not an actual payment arrangement.';
  resolution='Reject explicit invented payment arrangements. Preserve the known uninsured/access facts. Do not force a yes/no about actual payments; retain REVIEW if the question boundary remains ambiguous. No baseline label is overwritten.';
 }else{
  kind='application-overprecision-with-prior-evaluator-ambiguity';rootCause='About a year ago narrows loss timing toward twelve months, while canonical facts supply only within the past year.';
  resolution='Use the known bounded interval without inventing a date. Exact-date uncertainty is allowed if the interval remains clear. Reject additional approximate precision; no change to the canonical interval or historical V4 labels.';
 }
 return {testId:r.testId,v4Outcome:r.outcome,question:r.question,context:r.setupQuestions,response:r.finalResponse,recordedReason:r.reason,kind,rootCause,resolution,limitation};
});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function manifest(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?manifest(`${dir}/${e.name}`):[{path:`${dir}/${e.name}`,sha256:sha(fs.readFileSync(`${dir}/${e.name}`))}]);}
fs.writeFileSync('validation/v5/v4-evidence-manifest.json',JSON.stringify(manifest(baseline),null,2));
fs.writeFileSync('validation/v5/v4-diagnoses.json',JSON.stringify({at:new Date().toISOString(),total:diagnoses.length,byKind:Object.fromEntries([...new Set(diagnoses.map(d=>d.kind))].map(k=>[k,diagnoses.filter(d=>d.kind===k).length])),verificationSetupDefects:'V4 harness initially misclassified output-rejection502s as infrastructure failures. Its continuation recovered no-request placeholders. The final40 blocked items are valid setup requests rejected by the application, not defective setup wording.',items:diagnoses},null,2));
console.log({diagnosed:diagnoses.length});
