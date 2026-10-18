import fs from 'node:fs';
import crypto from 'node:crypto';
const root='validation/v6',read=p=>JSON.parse(fs.readFileSync(`${root}/${p}`)),sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const p=read('production-smoke.json'),config=read('production-configuration.json'),inventory=read('production-inventory.json').tests,freeze=read('implementation-freeze.json'),speech=read('speech-test.json');
const checks=[],check=(name,passed,evidence)=>checks.push({name,passed,evidence});
check('Actual frozen source unchanged',Object.entries(freeze.files).every(([p,h])=>sha(fs.readFileSync(p))===h),370);
check('Optimized production build unchanged during runtime test',Object.entries(config.artifacts).every(([p,h])=>sha(fs.readFileSync(p))===h),Object.keys(config.artifacts).length);
check('Actual production server configuration recorded',config.NODE_ENV==='production'&&config.baseUrl==='http://localhost:3003'&&config.testedCommit===freeze.commit&&config.buildId===fs.readFileSync('.next/BUILD_ID','utf8').trim(),{buildId:config.buildId,command:config.command});
check('Production and speech harnesses unchanged',config.harness.files.concat(config.speechHarnessFiles).every(f=>sha(fs.readFileSync(f.path))===f.sha256),config.harness.files.length+config.speechHarnessFiles.length);
check('Exact19 smoke questions/context and unique encounters',p.complete&&p.results.length===19&&new Set(p.results.map(r=>r.encounterId)).size===19&&inventory.every(i=>p.results.some(r=>r.testId===i.testId&&r.question===i.question&&JSON.stringify(r.setupQuestions)===JSON.stringify(i.setupQuestions))),19);
check('All successful production responses manually hash-bound',p.results.filter(r=>r.finalResponse).every(r=>r.responseSha256===sha(r.finalResponse)&&Object.values(r.dimensions).every(d=>['PASS','FAIL','REVIEW'].includes(d.status))),p.results.length);
check('Scored production text and request/encounter correlated',p.results.filter(r=>r.finalResponse).every(r=>r.httpStatus===200&&r.uiApiMatch&&r.correlationMatched&&r.finalResponse===r.apiFinalResponse),p.summary.scoredUiApiCorrelated);
check('Successful production setups separately reviewed and correlated',p.results.every(r=>r.setupTurns.every((t,i)=>t.uiApiMatch&&t.correlationMatched&&t.finalResponse===t.apiFinalResponse&&r.setupAssessments[i].responseSha256===sha(t.finalResponse))),p.summary.setupUiApiCorrelated);
check('Every production raw hash/screenshot/trace preserved',p.results.every(r=>sha(fs.readFileSync(r.rawPath))===r.rawSha256&&fs.existsSync(r.screenshot)&&fs.existsSync(r.trace)),p.results.length);
check('Speech attempt and audibility limits explicitly recorded',Boolean(speech.startedAt&&speech.completedAt&&speech.status&&speech.humanAudibility&&speech.baseUrl==='http://localhost:3003'),{status:speech.status,humanAudibility:speech.humanAudibility});
if(fs.existsSync(`${root}/speech-infrastructure-recovery.json`)){
 const recovery=read('speech-infrastructure-recovery.json'),first=read('speech-attempt-1.json');
 check('Speech probe-only retest documented; first result and both harnesses preserved',recovery.applicationUnchanged&&recovery.maxAdditionalAttempts===1&&recovery.files.every(f=>sha(fs.readFileSync(f.path))===f.sha256)&&first.status==='AUTOMATED_PLAYBACK_STARTED_COMPLETION_UNCONFIRMED'&&speech.attempt===2,{firstStatus:first.status,finalStatus:speech.status});
}
const provider=read('production-provider-http-log.json');check('Production HTTP retry policy observed and bounded',provider.summary.violations.length===0,provider.summary);
const registry=new Map(fs.readFileSync('C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/odontiq-v6-production-2026-10-17/encounters.jsonl','utf8').trim().split('\n').filter(Boolean).map(l=>{const r=JSON.parse(l);return [r.encounterId,r];}));
check('Production and speech encounters excluded from research',p.results.every(r=>registry.get(r.encounterId)?.researchExclusion)&&(!speech.encounterId||registry.get(speech.encounterId)?.researchExclusion),registry.size);
const result={at:new Date().toISOString(),checks,allIntegrityChecksPassed:checks.every(c=>c.passed)};fs.writeFileSync(`${root}/production-verification.json`,JSON.stringify(result,null,2));console.log({checks:checks.length,failed:checks.filter(c=>!c.passed)});if(!result.allIntegrityChecksPassed)process.exitCode=1;
