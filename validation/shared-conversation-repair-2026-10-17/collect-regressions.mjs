import fs from 'node:fs';
const out='validation/shared-conversation-repair-2026-10-17';
const start=JSON.parse(fs.readFileSync(`${out}/regression-start.json`));
const root='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/runs';
const rows=fs.readdirSync(root).filter(f=>f.endsWith('.json')&&!f.endsWith('_research-exclusion.json')&&fs.statSync(`${root}/${f}`).mtimeMs>=Date.parse(start.startedAt))
 .map(f=>({...JSON.parse(fs.readFileSync(`${root}/${f}`)),reportPath:`${root}/${f}`})).filter(r=>r.startedAt>=start.startedAt);
const turns=rows.flatMap(r=>r.turns.map(t=>({...t,caseId:r.caseId,scenarioId:r.scenarioId,runId:r.runId,reportPath:r.reportPath})));
const tally=a=>a.reduce((s,r)=>(s[r.status]=(s[r.status]??0)+1,s),{});
const summary={startedAt:start.startedAt,completedAt:new Date().toISOString(),method:'Existing Phase T specs and regression matchers unchanged; one worker; automatic retries0; real Clerk/UI/API/Navigator. These suites are separate from the 411 fresh-question cohorts.',scenarioCount:rows.length,turnCount:turns.length,scenarios:tally(rows),turns:tally(turns),bySuite:[...new Set(rows.map(r=>r.reportPath.includes('patient-background_')?'background':r.reportPath.includes('patient-residence-recovery_')?'residence-recovery':'travel-distinction'))].map(suite=>{const a=rows.filter(r=>(r.reportPath.includes('patient-background_')?'background':r.reportPath.includes('patient-residence-recovery_')?'residence-recovery':'travel-distinction')===suite);return {suite,scenarioCount:a.length,turnCount:a.reduce((n,r)=>n+r.turns.length,0),outcomes:tally(a)};}),reports:rows.map(r=>({caseId:r.caseId,scenarioId:r.scenarioId,status:r.status,encounterId:r.encounterId,turnCount:r.turns.length,blockedReason:r.blockedReason??null,reportPath:r.reportPath})),everyNonPassTurn:turns.filter(r=>r.status!=='PASS')};
fs.writeFileSync(`${out}/live-regression-results.json`,JSON.stringify(summary,null,2));
fs.writeFileSync(`${out}/live-regression-turns.json`,JSON.stringify(turns,null,2));
console.log(JSON.stringify({scenarioCount:rows.length,turnCount:turns.length,scenarios:summary.scenarios,turns:summary.turns,bySuite:summary.bySuite},null,2));
