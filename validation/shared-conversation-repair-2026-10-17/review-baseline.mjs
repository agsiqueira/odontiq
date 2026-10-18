import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/question-variations-2026-10-17', out='validation/shared-conversation-repair-2026-10-17';
const primary=JSON.parse(fs.readFileSync(`${root}/primary-results.json`)),pain=JSON.parse(fs.readFileSync(`${root}/pain-context-results.json`));
const irrelevance=new Set(['C01-G03-Q11','C02-G07-Q03','C02-G07-Q06','C02-G07-Q13','C04-G12-Q20','C04-G13-Q13','C04-G13-Q14','C01-G03-Q11-PAIN']);
const incorrect=new Set(JSON.parse(fs.readFileSync(`${root}/failure-patterns.json`)).find(p=>p.name==='Invented facts or unsupported restrictions').ids.concat(['C03-G08-Q17','C03-G09-Q01','C03-G09-Q03','C03-G09-Q05','C03-G09-Q08','C03-G09-Q09','C03-G09-Q17','C04-G12-Q18','C05-G17-Q03','C05-G17-Q04','C05-G17-Q14','C01-G03-Q17']));
const revisions=[];
const rows=[...primary,...pain].map(r=>{
 const dimension=(status,reason)=>({status,reason});
 const dimensions={factualCorrectness:dimension('PASS','No unsupported or contradictory assertion identified in the full response.'),completeness:dimension('PASS','Answers the requested concept(s) in the exact question and supplied context.'),relevance:dimension('PASS','Responsive; brief related concern/access context and approved catalog questions are permitted.'),leakage:dimension('PASS','No instruction leakage or role drift identified in final dialogue.')};
 if(r.outcome==='FAIL'){
  dimensions.completeness=dimension('FAIL',r.reason);
  if(incorrect.has(r.testId))dimensions.factualCorrectness=dimension('FAIL',r.reason);
  if(/uncertain|hesitation|unknown-information/i.test(r.reason) && /not sure|don't know|do not know|think about|depends on/i.test(r.finalResponse))dimensions.factualCorrectness=dimension('FAIL','Unsupported uncertainty about a defined fact: '+r.reason);
  if(/tooth location|instead|substitut|clinical|redirect|does not answer|not answer|irrelevant/i.test(r.reason))dimensions.relevance=dimension('FAIL',r.reason);
  // A complete requested proposition accompanied by an invented detail remains complete but false.
  if(['C02-G04-Q08','C02-G06-Q18','C03-G09-Q04','C03-G11-Q01','C03-G11-Q02','C03-G11-Q16','C04-G14-Q20','C01-G03-Q16-PAIN'].includes(r.testId))dimensions.completeness=dimension('PASS','The requested answer is present; unsupported additions fail factual correctness separately.');
 }else if(r.outcome==='REVIEW')dimensions.completeness=dimension('REVIEW',r.reason);
 if(irrelevance.has(r.testId))dimensions.relevance=dimension('FAIL','Unrelated true clinical/social/access history accompanies the requested answer; approved patient question is not the reason for failure.');
 let justification;
 if(r.testId==='C03-G09-Q13'){
  dimensions.completeness=dimension('PASS','The principal request is dentist status; lack of insurance is a supplied premise. Existing dentist and next-week appointment answer it.');
  justification=dimensions.completeness.reason;
 }
 if(r.testId==='C05-G17-Q11'){
  dimensions.completeness=dimension('PASS',"Read as a whole, 'I don't have any money right now' unambiguously answers inability to afford the modest fee despite the conversational uncertainty opener.");
  justification=dimensions.completeness.reason;
 }
 const statuses=Object.values(dimensions).map(d=>d.status);
 const revisedOutcome=statuses.includes('FAIL')?'FAIL':statuses.includes('REVIEW')?'REVIEW':'PASS';
 if(revisedOutcome!==r.outcome)revisions.push({testId:r.testId,originalLabel:r.outcome,revisedLabel:revisedOutcome,justification:justification??dimensions.relevance.reason,originalResponse:r.finalResponse,originalRunId:r.runId,responseSha256:crypto.createHash('sha256').update(r.finalResponse).digest('hex')});
 return {testId:r.testId,cohort:r.cohort,caseId:r.caseId,groupId:r.groupId,question:r.question,setupTurns:r.setupTurns,finalResponse:r.finalResponse,originalOutcome:r.outcome,originalReason:r.reason,revisedOutcome,dimensions,encounterId:r.encounterId,requestId:r.requestId};
});
const tally=a=>a.reduce((s,r)=>(s[r.revisedOutcome]++,s),{PASS:0,FAIL:0,REVIEW:0,ERROR:0,BLOCKED:0});
fs.writeFileSync(`${out}/baseline-dimensional-review.json`,JSON.stringify(rows,null,2));
fs.writeFileSync(`${out}/baseline-evaluator-revisions.json`,JSON.stringify({method:'Separate assistant review of existing observations. Original files/labels unchanged. Relevance dimension added; full-answer/premise interpretation corrections documented.',revisions,primaryRevisedTotals:tally(rows.filter(r=>!r.testId.endsWith('-PAIN'))),painContextRevisedTotals:tally(rows.filter(r=>r.testId.endsWith('-PAIN')))},null,2));
console.log(JSON.stringify({revisions,primary:tally(rows.filter(r=>!r.testId.endsWith('-PAIN'))),pain:tally(rows.filter(r=>r.testId.endsWith('-PAIN')))},null,2));
