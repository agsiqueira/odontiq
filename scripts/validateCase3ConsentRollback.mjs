import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import{randomUUID}from'node:crypto';
import{createJiti}from'jiti';import{PrismaClient}from'@prisma/client';
if(new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('Local database required');
const output='validation/case3-consent-only/transaction-check.json';if(fs.existsSync(output))throw Error('Preserve previous attempt');
const stub=path.resolve('dev-output/consent-server-only.mjs');fs.writeFileSync(stub,'export {};');
const jiti=createJiti(import.meta.url,{alias:{'server-only':stub,'@':path.resolve('src')}});
const{PatientQuestionService}=await jiti.import('../src/lib/persistence/services/patientQuestionService.ts');
const{db:serviceDb}=await jiti.import('../src/lib/persistence/repositories/prisma.ts');
const{createEmptyPatientQuestionState}=await jiti.import('../src/lib/patientQuestions/types.ts');
const{getPatientQuestion}=await jiti.import('../src/lib/patientQuestions/catalog.ts');
const db=new PrismaClient(),service=new PatientQuestionService();
try{
 const user=await db.user.create({data:{clerkUserId:'local-consent-rollback-'+randomUUID()}});
 const encounter=await db.encounter.create({data:{userId:user.id,caseId:'case-03',encounterData:{}}});
 await db.patientQuestionState.create({data:{encounterId:encounter.id,version:0,state:createEmptyPatientQuestionState()}});
 const message='I recommend an I&D for the abscess. Is that okay?';
 const classification={schemaVersion:1,caseId:'case-03',analyzedStudentMessageId:'current',confidence:1,evidenceAliases:['student-current','patient-draft'],evidenceMessageIds:['current','draft'],detectedEvents:{temporaryTreatmentActive:true,incisionAndDrainageProposed:true,patientAgreedToIncisionAndDrainage:true}};
 const input={userId:user.id,encounterId:encounter.id,caseId:'case-03',requestId:'rollback-'+randomUUID(),studentMessageId:'current',patientMessageId:'draft',baseResponse:'Yes, that’s okay.',providerName:'transaction-fixture',classification,questionEvidence:{studentMessage:message,conversation:[]},questionText:id=>getPatientQuestion(id)?.text};
 const before=await db.patientQuestionState.findUnique({where:{encounterId:encounter.id}});
 await assert.rejects(service.finalizeTurn({...input,validateFinalResponse:()=>{throw Error('intentional final validation rejection');}}));
 const after=await db.patientQuestionState.findUnique({where:{encounterId:encounter.id}});assert.deepEqual(after,before);
 assert.equal(await db.conversationTurn.count({where:{encounterId:encounter.id}}),0);assert.equal(await db.patientQuestionEmission.count({where:{encounterId:encounter.id}}),0);
 const accepted=await service.finalizeTurn(input);assert.equal(accepted.selectedQuestionId,'c3-follow-up-needed-question');assert.deepEqual(await service.finalizeTurn(input),accepted);
 const repeat=await service.finalizeTurn({...input,requestId:'repeat-'+randomUUID(),patientMessageId:randomUUID()});assert.equal(repeat.selectedQuestionId,undefined);
 assert.equal(await db.conversationTurn.count({where:{encounterId:encounter.id}}),2);assert.equal(await db.patientQuestionEmission.count({where:{encounterId:encounter.id}}),1);
 fs.writeFileSync(output,JSON.stringify({outcome:'PASS',encounterId:encounter.id,requestId:input.requestId,before,after,accepted,repeat,checks:['final rejection rolls back state, turn, emission','same-request recovery emits once','same-request replay idempotent','new-turn repeat does not emit again'],modelRequests:0},null,2));console.log('Real transaction rollback, recovery, idempotency and once-only: PASS');
}finally{await db.$disconnect();await serviceDb.$disconnect();}
