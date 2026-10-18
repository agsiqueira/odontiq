import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/v8',raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/odontiq-v8-production-2026-10-17/raw';
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const rows=fs.existsSync(raw)?fs.readdirSync(raw).filter(p=>p.endsWith('.json')).map(p=>({...JSON.parse(fs.readFileSync(`${raw}/${p}`)),rawPath:`${raw}/${p}`})):[];
const tests=JSON.parse(fs.readFileSync(`${root}/production-inventory.json`)).tests;
if(process.argv[2]==='show'){
 for(const t of tests){const r=rows.find(r=>r.testId===t.testId);if(r)console.log(JSON.stringify({id:r.testId,q:r.question,setup:r.setupTurns.map(s=>({q:s.question,a:s.finalResponse,provider:s.provider})),a:r.finalResponse,execution:r.outcome,error:r.error,uiApi:r.uiApiMatch,correlation:r.correlationMatched}));}
 console.log({recorded:rows.length,planned:tests.length});
}else if(process.argv[2]==='record'){
 const reason=process.argv[3];if(!reason||rows.length!==tests.length)throw Error('Complete inspected items and explicit review reason required');
 const exceptions=fs.existsSync(`${root}/production-overrides.json`)?JSON.parse(fs.readFileSync(`${root}/production-overrides.json`)):{};
 const results=tests.map(t=>{
  const r=rows.find(r=>r.testId===t.testId);if(!r)throw Error(t.testId);
  const dimensions=Object.fromEntries(['factualCorrectness','completeness','relevance','leakage'].map(k=>[k,exceptions[r.testId]?.[k]??{status:'PASS',reason}]));
  const outcome=!r.finalResponse||r.outcome==='ERROR'||!r.uiApiMatch||!r.correlationMatched?r.outcome==='BLOCKED'?'BLOCKED':'ERROR':Object.values(dimensions).some(d=>d.status==='FAIL')?'FAIL':Object.values(dimensions).some(d=>d.status==='REVIEW')?'REVIEW':'PASS';
  return {...r,dimensions,outcome,reviewedAt:new Date().toISOString(),responseSha256:r.finalResponse?sha(r.finalResponse):null,setupAssessments:r.setupTurns.map((s,i)=>({index:i,question:s.question,response:s.finalResponse,responseSha256:sha(s.finalResponse),outcome:exceptions[`${r.testId}:setup${i}`]?.outcome??'PASS',reason:exceptions[`${r.testId}:setup${i}`]?.reason??reason})),rawSha256:sha(fs.readFileSync(r.rawPath))};
 });
 const counts=Object.fromEntries(['PASS','FAIL','REVIEW','ERROR','BLOCKED'].map(k=>[k,results.filter(r=>r.outcome===k).length]));
 const result={at:new Date().toISOString(),complete:true,configuration:'production-configuration.json',summary:{planned:tests.length,counts,nonpass:results.filter(r=>r.outcome!=='PASS').length,scoredUiApiCorrelated:results.filter(r=>r.uiApiMatch&&r.correlationMatched&&r.finalResponse===r.apiFinalResponse).length,setupUiApiCorrelated:results.flatMap(r=>r.setupTurns).filter(t=>t.uiApiMatch&&t.correlationMatched&&t.finalResponse===t.apiFinalResponse).length,setupOutcomes:results.flatMap(r=>r.setupAssessments).map(s=>s.outcome)},results};
 result.summary.setupOutcomeCounts=Object.fromEntries(['PASS','FAIL','REVIEW','ERROR','BLOCKED'].map(k=>[k,results.flatMap(r=>r.setupAssessments).filter(s=>s.outcome===k).length]));
 result.summary.setupNonpass=results.flatMap(r=>r.setupAssessments).filter(s=>s.outcome!=='PASS').length;
 fs.writeFileSync(`${root}/production-smoke.json`,JSON.stringify(result,null,2));console.log(result.summary);
}
