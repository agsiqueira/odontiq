import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { CASE_DATA } from '../src/data/cases';
import { buildPatientDisclosureState, classifyQuestion } from '../src/lib/patientDisclosure';
import { requiredFactsForTurn } from '../src/lib/patientTurnFacts';
import { assessPatientOutputIntegrity } from '../src/lib/patientOutputGuard';
import { writeFileSync, mkdirSync } from 'node:fs';
loadEnvConfig(process.cwd());
async function main() {
 const db = new PrismaClient();
 try {
  const c = CASE_DATA[0];
  const question = 'can you travel for Affordable Care';
  const response = "I don't know, I'm not sure how far I can travel right now. I'm in a lot of pain.";
  const state = buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:question});
  const required = requiredFactsForTurn(state,question,c.supportingInfo.patientFacts);
  const turns = await db.conversationTurn.findMany({where:{encounter:{caseId:'case-01'},responseText:{contains:'how far I can travel'}},select:{encounterId:true,requestId:true,studentMessageId:true,responseText:true,providerName:true,createdAt:true}});
  const encounters = await db.encounter.findMany({where:{id:{in:turns.map(t=>t.encounterId)}},select:{id:true,version:true,createdAt:true,encounterData:true}});
  const historicalReplay = encounters.map(e=>{
   const data=e.encounterData as {messages?: Array<{id:string;role:'student'|'patient';text:string;timestamp:string}>};
   const messages=data.messages??[];
   const index=messages.findIndex(m=>turns.some(t=>m.id===t.studentMessageId));
   const historical=buildPatientDisclosureState({caseData:c,conversation:messages.slice(0,index),latestStudentMessage:question});
   return {encounterId:e.id,priorMessageCount:index,selected:historical.allowedThisTurn,required:requiredFactsForTurn(historical,question,c.supportingInfo.patientFacts),alreadyDisclosedIds:historical.alreadyDisclosed.map(f=>f.id)};
  });
  const evidence = {capturedAt:new Date().toISOString(),question,response,classification:classifyQuestion(question),selected:state.allowedThisTurn,required,assessment:assessPatientOutputIntegrity(response,c.supportingInfo.patientFacts??[],[],required),canonicalBackground:c.supportingInfo.patientFacts?.filter(f=>f.id.includes('background-')),turns,historicalReplay,encounters:encounters.map(e=>{const data=e.encounterData as Record<string,unknown>;return {id:e.id,version:e.version,createdAt:e.createdAt,keys:Object.keys(data),matchingConversation:JSON.stringify(data).includes(question),matchingResponse:JSON.stringify(data).includes(response),correlatedMessages:(Array.isArray(data.messages)?data.messages:[]).filter((m:Record<string,unknown>)=>turns.some(t=>m.id===t.studentMessageId))}})};
  mkdirSync('validation/transportation-2026-10-17',{recursive:true});
  const file=`validation/transportation-2026-10-17/${process.argv.includes('--after')?'after':'before'}.json`;
  writeFileSync(file,JSON.stringify(evidence,null,2)); console.log(JSON.stringify(evidence,null,2));
 } finally {await db.$disconnect();}
}
void main();
