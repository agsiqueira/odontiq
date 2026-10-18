import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/v5';
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rows=read(`${root}/results.json`),inventory=read(`${root}/run-inventory.json`).tests,freeze=read(`${root}/implementation-freeze.json`);
const baseline=read('validation/shared-conversation-followup-2026-10-17/final-v4/results.json');
const decisions=read(`${root}/adjudications.json`),setups=read(`${root}/setup-adjudications.json`),attempts=read(`${root}/all-recorded-attempts.json`);
const checks=[];
const check=(name,passed,detail)=>checks.push({name,passed,detail});
const changed=Object.entries(freeze.files).filter(([p,h])=>sha(fs.readFileSync(p))!==h).map(([p])=>p);
check('Frozen V5 source/runtime files unchanged',changed.length===0,{count:Object.keys(freeze.files).length,changed});
const copied=read(`${root}/v4-evidence-manifest.json`);
check('Copied frozen V4 evidence unchanged',copied.every(f=>sha(fs.readFileSync(f.path))===f.sha256),copied.length);
const original='C:/240 - odontIQ/odontiq';
check('Original V4 evidence unchanged',copied.every(f=>sha(fs.readFileSync(`${original}/${f.path}`))===f.sha256),copied.length);
const v4Freeze=read('validation/shared-conversation-followup-2026-10-17/final-v4/implementation-freeze.json');
check('Original V4 implementation remains byte-identical',Object.entries(v4Freeze.files).every(([p,h])=>sha(fs.readFileSync(`${original}/${p}`))===h),Object.keys(v4Freeze.files).length);
check('Authoritative case facts unchanged from V4',Object.entries(v4Freeze.files).filter(([p])=>/^src\/data\/cases\/.+case\.json$/.test(p)).every(([p,h])=>sha(fs.readFileSync(p))===h),5);
check('Exact546-item unique inventory and wording/context',rows.length===546&&new Set(rows.map(r=>r.testId)).size===546&&inventory.every(i=>rows.some(r=>r.testId===i.testId&&r.question===i.question&&JSON.stringify(r.setupQuestions)===JSON.stringify(i.setupQuestions)))&&JSON.stringify(inventory)===JSON.stringify(read('validation/shared-conversation-followup-2026-10-17/final-v4/run-inventory.json').tests),rows.length);
const delivered=rows.filter(r=>r.finalResponse),notDelivered=rows.filter(r=>!r.finalResponse);
check('All items have real recorded outcomes; no pending placeholders',rows.every(r=>r.encounterId&&['PASS','FAIL','REVIEW','ERROR','BLOCKED'].includes(r.outcome)&&!r.reason.includes('Pending live execution')),rows.length);
check('Every delivered response individually adjudicated and bound to its hash',delivered.every(r=>decisions.some(d=>d.runId===r.runId&&d.responseSha256===sha(r.finalResponse))&&Object.keys(r.dimensions).length===4&&Object.values(r.dimensions).every(d=>['PASS','FAIL','REVIEW'].includes(d.status))),delivered.length);
check('Non-delivered responses remain ERROR/BLOCKED, not semantic passes',notDelivered.every(r=>['ERROR','BLOCKED'].includes(r.outcome)&&Object.values(r.dimensions).every(d=>d.status==='NOT_ASSESSED')),{count:notDelivered.length,ids:notDelivered.map(r=>r.testId)});
check('Exact UI/API text and request/encounter correlation for all delivered responses',delivered.every(r=>r.provider==='navigator'&&r.httpStatus===200&&r.uiApiMatch&&r.correlationMatched&&r.finalResponse===r.apiFinalResponse),{checked:delivered.length,total:546,mismatches:delivered.filter(r=>!r.uiApiMatch||!r.correlationMatched||r.finalResponse!==r.apiFinalResponse).map(r=>r.testId)});
const successfulSetups=rows.flatMap(r=>r.setupTurns.map((t,i)=>({r,t,i})));
check('Every successful setup separately adjudicated and UI/API correlated',successfulSetups.every(({r,t,i})=>t.httpStatus===200&&t.provider==='navigator'&&t.uiApiMatch&&t.correlationMatched&&t.finalResponse===t.apiFinalResponse&&setups.some(s=>s.runId===r.runId&&s.setupTurnIndex===i&&s.responseSha256===sha(t.finalResponse))),successfulSetups.length);
check('Every delivered scored question has its full unchanged setup',delivered.every(r=>r.setupTurns.length===r.setupQuestions.length&&r.setupTurns.every((t,i)=>t.question===r.setupQuestions[i])),delivered.length);
check('All item encounters are distinct and fresh',new Set(rows.map(r=>r.encounterId)).size===546&&rows.filter(r=>r.finalResponse).every(r=>r.freshState?.boundEncounterId===r.encounterId&&r.freshState.patientCount===0&&r.freshState.studentCount===0&&r.freshState.transcriptCount===0),546);
check('No recorded scored submission repeated',rows.every(r=>attempts.filter(a=>a.testId===r.testId&&(a.apiAttempts?.length??0)>0).length<=1),546);
check('First real outcome retained despite any continuation history',rows.every(r=>attempts.filter(a=>a.testId===r.testId).sort((a,b)=>a.startedAt.localeCompare(b.startedAt)).find(a=>a.encounterId!==null||(a.apiAttempts?.length??0)>0)?.runId===r.runId),546);
check('Scored request wording preserved',rows.every(r=>r.apiAttempts.every(a=>a.requestMessage===r.question)),rows.filter(r=>r.apiAttempts.length).length);
const manifest=read(`${root}/raw-artifact-manifest.json`);
check('All raw-record hashes match',manifest.every(f=>sha(fs.readFileSync(f.path))===f.sha256),manifest.length);
check('Every non-pass has exact question/context, response-or-error reason and screenshot/trace',rows.filter(r=>r.outcome!=='PASS').every(r=>r.question&&r.reason&&r.screenshot&&r.trace&&fs.existsSync(r.screenshot)&&fs.existsSync(r.trace)),rows.filter(r=>r.outcome!=='PASS').map(r=>r.testId));
const registry=read(`${root}/research-exclusion.json`).encounters;
check('Synthetic exclusion registry covers every item encounter',new Set(registry.map(e=>e.encounterId)).size===registry.length&&rows.every(r=>registry.some(e=>e.encounterId===r.encounterId)),registry.length);
const harness=read(`${root}/harness-configuration.json`);
check('Frozen isolated verification harness unchanged',harness.files.every(f=>sha(fs.readFileSync(f.path))===f.sha256),harness.files);
check('All38 final automated checks passed',read(`${root}/automated-checks.json`).length===38&&read(`${root}/automated-checks.json`).every(c=>c.exitCode===0),38);
const log=read(`${root}/provider-http-log.json`),provider=read(`${root}/provider-attempts.json`);
check('All observed provider operations obey bounded gateway retry policy',log.summary.violations.length===0,log.summary);
const logCounts=new Map();
const key=a=>JSON.stringify([a.operationId??a.requestId,a.attempt,a.status,a.durationMs]);
for(const a of log.attempts)logCounts.set(key(a),(logCounts.get(key(a))??0)+1);
let missing=0;for(const a of provider){const k=key(a),n=logCounts.get(k)??0;if(n<1)missing++;else logCounts.set(k,n-1);}
check('Successful conversation provider attempts independently retained in server log',missing===0,{diagnosticAttempts:provider.length,missing});
const repairChecks=[
 {name:'Five V4 semantic failures now PASS',passed:baseline.filter(r=>r.outcome==='FAIL').every(b=>rows.find(r=>r.testId===b.testId)?.outcome==='PASS'),items:baseline.filter(r=>r.outcome==='FAIL').map(b=>({testId:b.testId,outcome:rows.find(r=>r.testId===b.testId)?.outcome}))},
 {name:'Sixteen V4 family rejection items now deliver a scored response',passed:baseline.filter(r=>r.outcome==='ERROR'&&/unsupported family/.test(r.reason)).every(b=>Boolean(rows.find(r=>r.testId===b.testId)?.finalResponse))},
 {name:'All40 previously BLOCKED scored questions actually submitted',passed:baseline.filter(r=>r.outcome==='BLOCKED').every(b=>rows.find(r=>r.testId===b.testId)?.apiAttempts.length>0),items:baseline.filter(r=>r.outcome==='BLOCKED').map(b=>({testId:b.testId,outcome:rows.find(r=>r.testId===b.testId)?.outcome}))},
 {name:'No regressions among474 V4 PASS items',passed:baseline.filter(b=>b.outcome==='PASS').every(b=>rows.find(r=>r.testId===b.testId)?.outcome==='PASS'),regressions:baseline.filter(b=>b.outcome==='PASS'&&rows.find(r=>r.testId===b.testId)?.outcome!=='PASS').map(b=>({testId:b.testId,v5:rows.find(r=>r.testId===b.testId)?.outcome}))},
];
const result={checkedAt:new Date().toISOString(),testedCommit:freeze.commit,checks,repairChecks,allIntegrityChecksPassed:checks.every(c=>c.passed),repairAcceptancePassed:repairChecks.every(c=>c.passed)};
fs.writeFileSync(`${root}/verification.json`,JSON.stringify(result,null,2));
console.log({integrityChecks:checks.length,failedIntegrityChecks:checks.filter(c=>!c.passed),repairChecks});
if(!result.allIntegrityChecksPassed)process.exitCode=1;
