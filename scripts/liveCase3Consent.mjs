// Paired local production builds. No production URLs, settings, or data writes.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClerkClient} from '@clerk/backend';
import {PrismaClient} from '@prisma/client';
const output='validation/case3-consent-only/live-results.json';
if(fs.existsSync(output))throw Error('Refusing to overwrite attempts');
if(!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))throw Error('Test authentication required');
const dbUrl=new URL(process.env.DATABASE_URL);if(dbUrl.hostname!=='127.0.0.1'||dbUrl.port!=='55440')throw Error('Isolated DB required');
const databases={};for(const target of ['candidate','v8']){const url=new URL(dbUrl);url.pathname=target==='candidate'?'/consent_candidate':'/consent_v8';databases[target]=new PrismaClient({datasources:{db:{url:url.href}}});}
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY});
const report={started:new Date().toISOString(),method:'Sequential paired local production builds; alternating order; original first attempts retained; no automatic test retries',tests:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));save();
const users=await clerk.users.getUserList({emailAddress:[process.env.PHASE_T_TEST_EMAIL]});if(users.data.length!==1)throw Error('Unique existing synthetic user required');
const session=await clerk.sessions.createSession({userId:users.data[0].id});report.ownedSessionId=session.id;save();
async function api(target,url,body){const token=await clerk.sessions.getToken(session.id),sentAt=new Date().toISOString(),start=performance.now();try{const r=await fetch(`http://localhost:${target==='candidate'?3018:3019}${url}`,{method:body?'POST':'GET',headers:{'content-type':'application/json',authorization:`Bearer ${token.jwt}`},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={nonJson:text.slice(0,1000)};}return{sentAt,receivedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-start),status:r.status,body:data};}catch(error){return{sentAt,receivedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-start),error:error.name};}}
const exact='I recommend an I&D for the abscess. Your dentist still needs to remove the affected tooth. Is that okay?';
const variants=[...Array.from({length:5},(_,i)=>({id:`original-${i+1}`,message:exact})),
 {id:'short',message:'I recommend an I&D for the abscess. Is that okay?'},
 {id:'spelled',message:'I recommend incision and drainage for the abscess. Is that okay?'},
 {id:'drain',message:'We need to drain the abscess. Do you agree?'},
 {id:'numb-drain',message:"I'd like to numb the area and drain the abscess. Is that okay?"},
 {id:'opening-pus',message:'I recommend making a small opening to let the pus out of the abscess. Is that okay?'},
 {id:'root-canal-history',history:true,message:'Did that tooth have a root canal before?'},
 {id:'extraction-history',history:true,message:'Was the painful tooth extracted before?'}];
try{
 report.auth=[];for(const target of ['candidate','v8']){const check=await api(target,'/api/me');report.auth.push({target,...check});save();if(check.status!==200)throw Error('Authentication preflight failed');}
 for(const[index,scenario]of variants.entries())for(const target of index%2?['v8','candidate']:['candidate','v8']){
  const row={scenario:scenario.id,target,history:!!scenario.history,attempts:[]};report.tests.push(row);save();row.setup=await api(target,'/api/encounters/start',{caseId:'case-03',fresh:true});save();if(row.setup.status!==200){row.outcome='ERROR';continue;}row.encounterId=row.setup.body.id;const conversation=[];
  for(const[label,message]of [['opening','What brings you in today?'],...(!scenario.history?[['prior-explanation','Draining the infection only relieves pressure; it does not provide definitive tooth treatment.']]:[]),[scenario.history?'history':'consent',scenario.message],...(!scenario.history?[['repeat',scenario.message]]:[]),['closure','Thank you.']]){
   const id=randomUUID(),requestId=`consent-only-${target}-${scenario.id}-${id}`,payload={encounterId:row.encounterId,caseId:'case-03',requestId,studentMessageId:id,conversation:structuredClone(conversation),coveredChecklistItems:[],message};
   const attempt={label,question:message,context:structuredClone(conversation),requestId,payload};row.attempts.push(attempt);save();Object.assign(attempt,await api(target,'/api/conversation',payload));
   attempt.persistedTurn=await databases[target].conversationTurn.findUnique({where:{encounterId_requestId:{encounterId:row.encounterId,requestId}}});attempt.persistedState=await databases[target].patientQuestionState.findUnique({where:{encounterId:row.encounterId}});attempt.emissions=await databases[target].patientQuestionEmission.findMany({where:{encounterId:row.encounterId}});
   if(attempt.body?.success)conversation.push({id,role:'student',text:message,timestamp:attempt.sentAt},{id:attempt.body.patientMessageId,role:'patient',text:attempt.body.response,timestamp:attempt.receivedAt});save();
  }
  row.structuralFailures=[];for(const a of row.attempts){if(a.status!==200||!a.body?.success)row.structuralFailures.push(`${a.label}: unsuccessful`);else if(a.body.encounterId!==row.encounterId||a.body.requestId!==a.requestId||a.persistedTurn?.responseText!==a.body.response)row.structuralFailures.push(`${a.label}: response correlation/persistence mismatch`);}
  if(!scenario.history&&row.attempts.find(a=>a.label==='consent')?.body?.selectedQuestionId!=='c3-follow-up-needed-question')row.structuralFailures.push('Consent omitted first follow-up');
  if(row.attempts.find(a=>a.label==='repeat')?.body?.selectedQuestionId)row.structuralFailures.push('Repeated consent emitted another question');
  row.outcome=row.structuralFailures.length?'FAIL':'REVIEW';save();console.log(target,scenario.id,row.outcome);
 }
 report.finished=new Date().toISOString();save();
}finally{for(const db of Object.values(databases))await db.$disconnect();await clerk.sessions.revokeSession(session.id);report.exactOwnedSessionRevoked=true;save();}

