import fs from 'node:fs';
const input=process.argv[2];const r=JSON.parse(fs.readFileSync(input));const capture=process.argv[3]?fs.readFileSync(process.argv[3],'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const percentile=(values,p)=>{const a=[...values].sort((a,b)=>a-b);return a.length?a[Math.max(0,Math.ceil(a.length*p)-1)]:null};
const stats=values=>{const a=[...values].sort((a,b)=>a-b),n=a.length;return{n,medianMs:n?(a[Math.floor((n-1)/2)]+a[Math.ceil((n-1)/2)])/2:null,p95Ms:percentile(a,.95),minMs:n?a[0]:null,maxMs:n?a.at(-1):null}};
const summary={method:r.method,percentile:'nearest rank; median is middle or mean of middle pair; every first attempt retained',targets:{},scenarios:{}};
for(const target of ['production-v8','local-candidate']){
 const tests=r.tests.filter(t=>t.target===target),turns=tests.flatMap(t=>t.attempts),timed=turns.filter(a=>typeof a.durationMs==='number');
 summary.targets[target]={outcomes:Object.fromEntries(['PASS','FAIL','ERROR'].map(k=>[k,tests.filter(t=>t.outcome===k).length])),apiAttempts:turns.length,httpStatus:Object.fromEntries([...new Set(turns.map(t=>t.status??t.error))].map(s=>[s,turns.filter(t=>(t.status??t.error)===s).length])),allTurns:stats(timed.map(t=>t.durationMs)),excludingClosure:stats(timed.filter(a=>a.label!=='closure').map(t=>t.durationMs)),labels:Object.fromEntries([...new Set(timed.map(a=>a.label))].map(label=>[label,stats(timed.filter(a=>a.label===label).map(a=>a.durationMs))]))};
 if(target==='local-candidate'){
  const attributed=capture.filter(c=>turns.some(a=>a.sentAt&&a.receivedAt&&c.at>=a.sentAt&&c.at<=a.receivedAt));summary.targets[target].capturedModelCalls={total:attributed.length,byModel:Object.fromEntries([...new Set(attributed.map(c=>c.request.model))].map(m=>[m,attributed.filter(c=>c.request.model===m).length])),byKind:Object.fromEntries([...new Set(attributed.map(c=>c.kind))].map(k=>[k,attributed.filter(c=>c.kind===k).length])),httpNon200:attributed.filter(c=>c.status!==200).length};
  for(const t of tests)for(const a of t.attempts)a.modelCalls=capture.filter(c=>c.at>=a.sentAt&&c.at<=a.receivedAt).map(c=>({kind:c.kind,model:c.request.model,status:c.status,durationMs:c.durationMs}));
 }
 for(const scenario of [...new Set(tests.map(t=>t.scenario))]){summary.scenarios[scenario]??={};const selected=tests.filter(t=>t.scenario===scenario);summary.scenarios[scenario][target]={counts:Object.fromEntries(['PASS','FAIL','ERROR'].map(k=>[k,selected.filter(t=>t.outcome===k).length])),latency:stats(selected.flatMap(t=>t.attempts).map(a=>a.durationMs).filter(x=>typeof x==='number'))}}
}
fs.writeFileSync(input.replace(/\.json$/,'-summary.json'),JSON.stringify(summary,null,2));fs.writeFileSync(input.replace(/\.json$/,'-with-local-call-attribution.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(summary,null,2));
