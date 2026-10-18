import fs from 'node:fs';import crypto from'node:crypto';
const dir='validation/case3-consent-only/',r=JSON.parse(fs.readFileSync(dir+'live-results.json'));
if(!r.finished)throw Error('Incomplete live run');
const captures=fs.readFileSync(dir+'navigator-attempts.jsonl','utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const stats=values=>{const a=values.toSorted((a,b)=>a-b);return{n:a.length,medianMs:a.length%2?a[Math.floor(a.length/2)]:(a[a.length/2-1]+a[a.length/2])/2,p95Ms:a[Math.ceil(a.length*.95)-1]};};
const summary={method:'Same-host local production builds with separate databases, sequential alternating target order. All first attempts included. Latency excludes authentication token acquisition. No production writes.',targets:{},models:[...new Set(captures.map(c=>c.request.model))]};
for(const target of ['candidate','v8']){
 const rows=r.tests.filter(t=>t.target===target),attempts=rows.flatMap(t=>t.attempts),calls=captures.filter(c=>c.target===target&&r.started<=c.at&&c.at<=r.finished);
 summary.targets[target]={scenarios:rows.length,structurallyClear:rows.filter(t=>!t.structuralFailures.length).length,requests:attempts.length,all:stats(attempts.map(a=>a.durationMs)),consent:stats(attempts.filter(a=>a.label==='consent').map(a=>a.durationMs)),modelHttpAttempts:calls.length,modelKinds:Object.fromEntries(['classifier','generation'].map(k=>[k,calls.filter(c=>c.kind===k).length])),upstreamNon200:calls.filter(c=>c.status!==200).length};
 for(const a of attempts){const matching=calls.filter(c=>a.sentAt<=c.at&&c.at<=a.receivedAt);a.modelHttpAttempts=matching.length;a.modelKinds=matching.map(c=>c.kind);}
}
const freeze=JSON.parse(fs.readFileSync(dir+'freeze.json'));summary.freeze={commit:freeze.commit,files:Object.keys(freeze.files).length,mismatches:Object.entries(freeze.files).filter(([p,h])=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==h).map(([p])=>p)};
fs.writeFileSync(dir+'live-results-with-call-counts.json',JSON.stringify(r,null,2));fs.writeFileSync(dir+'summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
