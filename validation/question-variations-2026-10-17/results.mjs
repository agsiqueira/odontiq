import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const out=path.resolve('validation/question-variations-2026-10-17');
const phase='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/question-variations-2026-10-17';
const inventory=JSON.parse(readFileSync(path.join(out,'inventory.json'),'utf8'));
const raws=existsSync(path.join(phase,'raw'))?readdirSync(path.join(phase,'raw')).filter(f=>f.endsWith('.json')).map(f=>({rawFile:path.join(phase,'raw',f),...JSON.parse(readFileSync(path.join(phase,'raw',f),'utf8'))})).sort((a,b)=>a.startedAt.localeCompare(b.startedAt)):[];
if(process.argv.includes('--inspect')){
 const group=process.argv.at(-1);
 const ids=[...new Set(raws.filter(r=>r.groupId===group||r.cohort===group).map(r=>r.testId))];
 for(const id of ids){const attempts=raws.filter(r=>r.testId===id);const r=attempts.find(r=>r.finalResponse!==null)??attempts[0];if(r.finalResponse===null)continue;console.log(JSON.stringify({id:r.testId,q:r.question,setup:r.setupTurns.map(t=>({q:t.question,a:t.finalResponse})),a:r.finalResponse,provider:r.provider,outcome:r.outcome,error:r.error?.slice(0,160)??null}));}
 process.exit(0);
}
const adjudications=existsSync(path.join(out,'adjudications.json'))?JSON.parse(readFileSync(path.join(out,'adjudications.json'),'utf8')):{};
const setupObservations=existsSync(path.join(out,'setup-observations.json'))?JSON.parse(readFileSync(path.join(out,'setup-observations.json'),'utf8')):{};
const results=inventory.tests.map(item=>{
 const attempts=raws.filter(r=>r.testId===item.testId);
 if(!attempts.length)return {...item,setupTurns:[],finalResponse:null,outcome:'BLOCKED',reason:'Not executed yet or execution stopped; see execution limitations.',encounterId:null,requestId:null,attempts:0};
 const firstAttempt=attempts[0];
 const first=attempts.find(r=>r.finalResponse!==null&&r.httpStatus===200&&r.uiApiMatch&&r.correlationMatched)??firstAttempt;
 if(first.question!==item.question)throw Error(`Exact wording mismatch ${item.testId}`);
 const review=adjudications[item.testId];
 if(review&&(review.runId!==first.runId||review.responseSha256!==createHash('sha256').update(first.finalResponse??'').digest('hex')))throw Error(`Stale adjudication ${item.testId}`);
 const contextNotes=[...(setupObservations[item.testId]??[])];
 if(item.cohort==='pain-context'&&/at first/i.test(first.setupTurns?.[1]?.finalResponse??''))contextNotes.push('The second setup response gives historical initial 3/10 pain instead of answering current feelings. The first setup explicitly established current 8/10 severe pain; historical 3/10 does not replace current severity. This setup non-responsiveness is not scored as a travel answer.');
 return {...first,firstAttemptRunId:firstAttempt.runId,firstAttemptOutcome:firstAttempt.outcome,firstAttemptReason:firstAttempt.reason,automatedOutcome:first.outcome,automatedReason:first.reason,...(review?{outcome:review.outcome,reason:review.reason,adjudicator:'Assistant semantic review; question, setup, response and defined facts',adjudication:review}:{}),setupObservations:contextNotes,attempts:attempts.length};
});
const statuses=['PASS','FAIL','REVIEW','ERROR','BLOCKED'];
const counts=rows=>Object.fromEntries(statuses.map(s=>[s,rows.filter(r=>r.outcome===s).length]));
const primary=results.filter(r=>r.cohort==='primary'),pain=results.filter(r=>r.cohort==='pain-context');
const summary={generatedAt:new Date().toISOString(),accounting:{expectedPrimary:340,primaryRows:primary.length,uniquePrimaryIds:new Set(primary.map(r=>r.testId)).size,executedPrimary:primary.filter(r=>r.finalResponse!==null&&r.requestId).length,expectedPain:20,painRows:pain.length,executedPain:pain.filter(r=>r.finalResponse!==null&&r.requestId).length,allPrimaryAccountedExactlyOnce:primary.length===340&&new Set(primary.map(r=>r.testId)).size===340,duplicateRawAttempts:raws.length-new Set(raws.map(r=>r.testId)).size},primaryTotals:counts(primary),painContextTotals:counts(pain),byCase:[...new Set(primary.map(r=>r.caseId))].map(caseId=>({caseId,...counts(primary.filter(r=>r.caseId===caseId))})),byGroup:inventory.groups.map(g=>{const rows=primary.filter(r=>r.caseId===g.caseId&&r.groupTitle===g.title);return {caseId:g.caseId,groupId:rows[0]?.groupId,title:g.title,total:rows.length,...counts(rows)};})};
const json=(name,value)=>writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
json('primary-results.json',primary);json('pain-context-results.json',pain);json('summary.json',summary);json('all-raw-attempts.json',raws);
const columns=['testId','primaryTestId','caseId','groupId','groupTitle','cohort','question','setupTurns','setupObservations','finalResponse','apiFinalResponse','outcome','reason','encounterId','requestId','provider','httpStatus','uiApiMatch','correlationMatched','runId','attempt','attemptKind','attempts','firstAttemptRunId','firstAttemptOutcome','firstAttemptReason','screenshot','trace','rawFile'];
const csv=rows=>[columns.join(','),...rows.map(r=>columns.map(c=>'"'+String(typeof r[c]==='object'?JSON.stringify(r[c]):r[c]??'').replaceAll('"','""')+'"').join(','))].join('\r\n');
writeFileSync(path.join(out,'primary-results.csv'),'\uFEFF'+csv(primary));writeFileSync(path.join(out,'pain-context-results.csv'),'\uFEFF'+csv(pain));
const events=existsSync(path.join(phase,'encounters.jsonl'))?readFileSync(path.join(phase,'encounters.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l)):[];
const registry=[...new Set(events.map(e=>e.encounterId))].map(id=>({encounterId:id,researchExclusion:true,events:events.filter(e=>e.encounterId===id)}));json('research-exclusion.json',{purpose:'Exclude all listed synthetic encounters from participant research, including setup, incomplete and retry records.',encounters:registry});
if(process.argv.includes('--final')){
 if(summary.accounting.executedPrimary!==340||summary.accounting.executedPain!==20||!summary.accounting.allPrimaryAccountedExactlyOnce)throw Error('Incomplete execution accounting');
 if(results.some(r=>r.reason==='Awaiting semantic adjudication of the actual final response.'))throw Error('Unreviewed semantic results remain');
}
console.log(JSON.stringify({accounting:summary.accounting,primary:summary.primaryTotals,pain:summary.painContextTotals,syntheticEncounters:registry.length},null,2));
