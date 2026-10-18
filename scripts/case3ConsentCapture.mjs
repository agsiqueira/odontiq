// Loopback-only verification transport; never saves headers or credentials.
import http from 'node:http';
import fs from 'node:fs';
const output='validation/case3-consent-only/navigator-attempts.jsonl';
let fault;
http.createServer(async(req,res)=>{
 let body='';for await(const chunk of req)body+=chunk;
 if(req.url==='/__fault'){fault=JSON.parse(body);res.end('armed');return;}
 const target=req.url.split('/')[1],request=JSON.parse(body),at=new Date().toISOString(),start=performance.now();
 const record={target,at,request,kind:body.includes('schemaVersion')&&body.includes('student-current')?'classifier':'generation'};
 try{
  if(!['candidate','v8'].includes(target)||request.model!=='granite-3.3-8b-instruct')throw Error('Unexpected target/model');
  if(fault?.target===target&&fault.kind===record.kind&&fault.remaining>0){record.injected=true;record.status=503;record.response='{"error":"injected local transport failure"}';fault.remaining--;}
  else{const upstream=await fetch('https://api.ai.it.ufl.edu'+req.url.slice(target.length+1),{method:'POST',headers:{'content-type':'application/json',authorization:req.headers.authorization},body});record.status=upstream.status;record.response=await upstream.text();}
 }catch(error){record.status=502;record.error=error.message;record.response='{"error":"verification transport failure"}';}
 record.durationMs=Math.round(performance.now()-start);fs.appendFileSync(output,JSON.stringify(record)+'\n');res.writeHead(record.status,{'content-type':'application/json'});res.end(record.response);
}).listen(3020,'127.0.0.1',()=>console.log('Local Granite capture on 3020'));
