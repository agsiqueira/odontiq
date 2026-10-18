import fs from 'node:fs';
import crypto from 'node:crypto';
const file='dev-output/v5-server.log';
const text=fs.readFileSync(file,'utf8').replace(/\x1b\[[0-9;]*m/g,'');
const attempts=[];
const ordinals=new Map();
for(const m of text.matchAll(/navigator_http_attempt\s+\{([^}]+)\}/g)){
 const body=m[1];
 const operationId=body.match(/operationId:\s*'([^']+)'/)?.[1];
 const attempt=Number(body.match(/\battempt:\s*(\d+)/)?.[1]);
 if(!operationId||!attempt)throw Error('Unparseable provider attempt entry');
 if(attempt===1)ordinals.set(operationId,(ordinals.get(operationId)??0)+1);
 attempts.push({sequence:attempts.length+1,operationId,generation:ordinals.get(operationId),attempt,status:body.match(/\bstatus:\s*(\d+)/)?Number(body.match(/\bstatus:\s*(\d+)/)[1]):null,outcome:body.match(/outcome:\s*'([^']+)'/)?.[1],durationMs:Number(body.match(/durationMs:\s*(\d+)/)?.[1]),retryable:/retryable:\s*true/.test(body),logEntrySha256:crypto.createHash('sha256').update(m[0]).digest('hex')});
}
const groups=[...new Set(attempts.map(a=>`${a.operationId}#${a.generation}`))].map(key=>({key,attempts:attempts.filter(a=>`${a.operationId}#${a.generation}`===key)}));
const retryGroups=groups.filter(g=>g.attempts.length>1);
const violations=groups.filter(g=>g.attempts.length>2||g.attempts[0].attempt!==1||g.attempts.some((a,i)=>a.attempt!==i+1)||g.attempts.length>1&&![502,503,504].includes(g.attempts[0].status));
const result={capturedAt:new Date().toISOString(),privateSource:file,method:'Safe field parsing of dedicated navigator_http_attempt log objects; no eval, credentials, prompts or response content. Repeated attempt1 with the same request ID starts a distinct corrective generation.',attempts,summary:{httpAttempts:attempts.length,generationOperations:groups.length,retryOperations:retryGroups.length,recoveredAfterGatewayFailure:retryGroups.filter(g=>g.attempts.at(-1).status===200).length,httpStatusCounts:Object.fromEntries([...new Set(attempts.map(a=>String(a.status)))].map(s=>[s,attempts.filter(a=>String(a.status)===s).length])),violations},retryGroups};
fs.writeFileSync('validation/v5/provider-http-log.json',JSON.stringify(result,null,2));
console.log(result.summary);
if(violations.length)process.exitCode=1;
