import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import{randomUUID}from'node:crypto';
import{createJiti}from'jiti';import{PrismaClient}from'@prisma/client';
if(new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('Isolated local DB required');
const output=process.env.CASE3_DB_CHECK_OUTPUT;
if(!output||fs.existsSync(output))throw Error('New CASE3_DB_CHECK_OUTPUT required');
const jiti=createJiti(import.meta.url,{alias:{'server-only':path.resolve('scripts/fixtures/serverOnlyStub.mjs'),'@':path.resolve('src')}});
const{PatientQuestionService}=await jiti.import('../src/lib/persistence/services/patientQuestionService.ts');
const{db:serviceDb}=await jiti.import('../src/lib/persistence/repositories/prisma.ts');
const{createEmptyPatientQuestionState}=await jiti.import('../src/lib/patientQuestions/types.ts');
const db=new PrismaClient(),service=new PatientQuestionService(),records=[];
try{
 for(const kind of ['emission','explanation']){
  const user=await db.user.create({data:{clerkUserId:'local-case3-rollback-'+randomUUID()}});
  const encounter=await db.encounter.create({data:{userId:user.id,caseId:'case-03',encounterData:{}}});
  const prior=createEmptyPatientQuestionState();prior.version=1;prior.detectedEvents.temporaryTreatmentActive=true;prior.emittedQuestionIds=['c3-follow-up-needed-question'];
  await db.patientQuestionState.create({data:{encounterId:encounter.id,version:1,state:prior}});
  const message=kind==='emission'?'Yes, you still need to see your dentist promptly.':'Drainage is temporary. You still need root canal treatment.';
  const classification={schemaVersion:1,caseId:'case-03',analyzedStudentMessageId:'current',confidence:1,evidenceAliases:['student-current'],evidenceMessageIds:['current'],detectedEvents:{promptDentalFollowUpConfirmed:true},case3Explanations:kind==='explanation'?{temporary:{messageId:'current',quote:'Drainage is temporary.'},definitive:{messageId:'current',quote:'You still need root canal treatment.'}}:{}};
  const input={userId:user.id,encounterId:encounter.id,caseId:'case-03',requestId:'rollback-'+randomUUID(),studentMessageId:'current',patientMessageId:randomUUID(),baseResponse:'Okay.',providerName:'local-transaction-fixture',classification,questionEvidence:{studentMessage:message,conversation:[]},questionText:()=> 'Why?'};
  const before=await db.patientQuestionState.findUnique({where:{encounterId:encounter.id}});
  await assert.rejects(service.finalizeTurn({...input,validateFinalResponse:()=>{throw Error('intentional final-validation rejection');}}));
  const after=await db.patientQuestionState.findUnique({where:{encounterId:encounter.id}});
  assert.deepEqual(after,before);
  assert.equal(await db.conversationTurn.count({where:{encounterId:encounter.id}}),0);
  assert.equal(await db.patientQuestionEmission.count({where:{encounterId:encounter.id}}),0);
  const accepted=await service.finalizeTurn(input);assert.equal(accepted.selectedQuestionId,kind==='emission'?'c3-follow-up-why':undefined);
  assert.deepEqual(await service.finalizeTurn(input),accepted);
  assert.equal(await db.conversationTurn.count({where:{encounterId:encounter.id}}),1);
  assert.equal(await db.patientQuestionEmission.count({where:{encounterId:encounter.id}}),kind==='emission'?1:0);
  records.push({kind,encounterId:encounter.id,requestId:input.requestId,rejectedAttempt:'intentional final validation rejection',before,after,accepted,outcome:'PASS'});
  fs.writeFileSync(output,JSON.stringify({scope:'real isolated PostgreSQL and actual final-assembly service; deterministic fixtures, no Navigator calls',records},null,2));
 }
 console.log('Real PostgreSQL rollback, evidence atomicity, same-request recovery and idempotency: PASS (2 fresh fixture encounters).');
}finally{await db.$disconnect();await serviceDb.$disconnect();}
