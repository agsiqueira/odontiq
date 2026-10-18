/** Paired live latency benchmark. Production receives only labeled synthetic tests
 * owned by a newly created isolated Clerk test user. No existing encounters touched.
 * API duration excludes token acquisition; includes server/auth/DB/model/final assembly.
 */
import {PrismaClient} from '@prisma/client';
import fs from 'node:fs';import {randomUUID} from 'node:crypto';import {createClerkClient} from '@clerk/backend';
const output=process.env.CASE3_BENCH_OUTPUT; if(!output||fs.existsSync(output))throw Error('New output required');
if(!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))throw Error('Clerk test instance required');
if(new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('Local evidence database required');
const db=new PrismaClient();
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY});
const report={started:new Date().toISOString(),method:'Five repetitions per scenario, paired alternating target order, fresh encounters, sequential requests; no retries; API wall time excluding Clerk token acquisition; production V8 vs local candidate is confounded by host/network/DB differences',productionCommit:'69a24fe9fb6d1121e67da8d2ce70cc02b574266c',candidateCommit:process.env.CASE3_CANDIDATE_COMMIT,tests:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));save();
const user=await clerk.users.createUser({emailAddress:[`odontiq-pr3-${randomUUID()}+clerk_test@example.com`],password:randomUUID()+'Aa1!',firstName:'PR3',lastName:'Latency fixture',unsafeMetadata:{testPurpose:'PR3 repair-7 paired latency benchmark'}});
report.clerkUserId=user.id;save();const session=await clerk.sessions.createSession({userId:user.id});report.clerkSessionId=session.id;save();
const consent='You have an abscess. I recommend an I&D to drain the infection and relieve the pressure. Is that okay?';const confirm='Yes, you still need to see your dentist promptly.';
const scenarios=[{id:'original',consent,answer:confirm,why:true},{id:'complete',consent,answer:'Yes, see your dentist promptly. Drainage only relieves the pressure; you still need root canal treatment or extraction to treat the tooth.',why:false},{id:'split',before:'Draining the infection only relieves pressure; it does not provide definitive tooth treatment.',consent:'I recommend an I&D for the abscess. Your dentist still needs to remove the affected tooth. Is that okay?',answer:confirm,why:false}];
async function api(base,url,body){const token=await clerk.sessions.getToken(session.id);const sentAt=new Date().toISOString(),t=performance.now();try{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'content-type':'application/json',authorization:`Bearer ${token.jwt}`},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={nonJson:text.slice(0,500)}}return{sentAt,receivedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-t),status:r.status,body:data}}catch(e){return{sentAt,receivedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-t),error:e.name}}}
try{
 report.authChecks=[];for(const base of ['https://odontiq.onrender.com','http://localhost:3009']){const r=await api(base,'/api/me');report.authChecks.push({base,...r});save();if(r.status!==200)throw Error('Dedicated benchmark authentication failed; inspect sanitized record')}
 for(let repeat=1;repeat<=5;repeat++)for(const scenario of scenarios)for(const target of repeat%2?['production-v8','local-candidate']:['local-candidate','production-v8']){
  const base=target==='production-v8'?'https://odontiq.onrender.com':'http://localhost:3009';const row={repeat,scenario:scenario.id,target,expectedWhy:scenario.why,attempts:[]};report.tests.push(row);save();
  row.setup=await api(base,'/api/encounters/start',{caseId:'case-03',fresh:true});save();if(row.setup.status!==200){row.outcome='ERROR';continue}row.encounterId=row.setup.body.id;const conversation=[];
  for(const [label,message]of [['opening','What brings you in today?'],...(scenario.before?[['prior-explanation',scenario.before]]:[]),['consent',scenario.consent],['confirmation',scenario.answer],['repeat',confirm],['closure','Thank you for explaining that.']]){
   const id=randomUUID(),requestId=`pr3-repair7-latency-${target}-${scenario.id}-${repeat}-${id}`;const attempt={label,question:message,context:structuredClone(conversation),requestId};row.attempts.push(attempt);save();Object.assign(attempt,await api(base,'/api/conversation',{encounterId:row.encounterId,caseId:'case-03',requestId,studentMessageId:id,conversation,coveredChecklistItems:[],message}));
   if(target==='local-candidate'){
    attempt.persistedState=await db.patientQuestionState.findUnique({where:{encounterId:row.encounterId}});
    attempt.persistedTurn=await db.conversationTurn.findUnique({where:{encounterId_requestId:{encounterId:row.encounterId,requestId}}});
    const expected=label==='prior-explanation'?[true,false]:label==='consent'?(scenario.id==='split'?[false,true]:[true,false]):label==='confirmation'&&scenario.id==='complete'?[true,true]:[false,false];
    attempt.expectedCurrentEvidence=expected;
    attempt.evidenceFailures=[];
    for(const [index,kind]of ['temporary','definitive'].entries()){
     const proof=attempt.persistedState?.state?.case3Explanations?.[kind],current=!!proof&&proof.messageId===id;
     if(current!==expected[index])attempt.evidenceFailures.push(`${kind} current evidence mismatch`);
    }
   }
   if(attempt.body?.success)conversation.push({id,role:'student',text:message,timestamp:attempt.sentAt},{id:attempt.body.patientMessageId,role:'patient',text:attempt.body.response,timestamp:attempt.receivedAt});save();
  }
  const failures=[];for(const a of row.attempts){if(a.status!==200||!a.body?.success)failures.push(`${a.label}: unsuccessful`);if(a.body?.success&&(a.body.requestId!==a.requestId||a.body.encounterId!==row.encounterId))failures.push(`${a.label}: correlation mismatch`)}
  if(row.attempts.find(a=>a.label==='consent')?.body?.selectedQuestionId!=='c3-follow-up-needed-question')failures.push('Consent missing first follow-up');const answer=row.attempts.find(a=>a.label==='confirmation');if(answer?.body?.selectedQuestionId!==(scenario.why?'c3-follow-up-why':undefined))failures.push('Confirmation disagrees with explanation eligibility');
  if(row.attempts.find(a=>a.label==='repeat')?.body?.selectedQuestionId)failures.push('Repeated confirmation emitted question');if(row.attempts.find(a=>a.label==='closure')?.body?.response!=="You're welcome.")failures.push('Closure mismatch');
  row.finalResponseFailures=[...failures];for(const a of row.attempts)for(const f of a.evidenceFailures??[])failures.push(`${a.label}: ${f}`);row.evidenceOutcome=target==='local-candidate'?(row.attempts.some(a=>a.evidenceFailures?.length)?'FAIL':'PASS'):'NOT_INSPECTED';row.failures=failures;row.outcome=failures.length?'FAIL':'PASS';save();console.log(target,scenario.id,repeat,row.outcome);
 }
 report.finished=new Date().toISOString();save();
}finally{await db.$disconnect();await clerk.sessions.revokeSession(session.id);report.exactOwnedSessionRevoked=true;save()}

