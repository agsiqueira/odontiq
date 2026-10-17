import fs from 'node:fs';
const out='validation/shared-conversation-repair-2026-10-17';
const raw='C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/shared-conversation-repair-2026-10-17-final-v2/raw';
const expected=[1,2,3,4,5].flatMap(n=>JSON.parse(fs.readFileSync(`src/data/cases/case-0${n}/case.json`)).supportingInfo.patientFacts.filter(f=>f.id.includes('.background-')));
const rows=fs.readdirSync(raw).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${raw}/${f}`)));
const observed=rows.flatMap(r=>[...r.setupTurns,r].flatMap(t=>t.apiAttempts.flatMap(a=>(a.syntheticDiagnostics?.selectedFacts??[]).map(f=>({...f,testId:r.testId,requestId:a.requestId,encounterId:a.encounterId})))));
const checks=expected.map(f=>({id:f.id,expectedText:f.text,observedInRuntime:observed.some(o=>o.id===f.id&&o.text===f.text),mismatchedObservedTexts:[...new Set(observed.filter(o=>o.id===f.id&&o.text!==f.text).map(o=>o.text))],example:observed.filter(o=>o.id===f.id&&o.text===f.text).slice(0,1).map(({testId,requestId,encounterId})=>({testId,requestId,encounterId}))}));
fs.writeFileSync(`${out}/loaded-background-facts.json`,JSON.stringify({capturedAt:new Date().toISOString(),checks,all16ObservedAndExact:checks.length===16&&checks.every(c=>c.observedInRuntime&&c.mismatchedObservedTexts.length===0),method:'Canonical background fact text compared with actual authenticated development-mode synthetic API diagnostics; no encounter snapshot facts substituted.'},null,2));
console.log({expected:checks.length,observed:checks.filter(c=>c.observedInRuntime).length,mismatches:checks.filter(c=>c.mismatchedObservedTexts.length).length});
