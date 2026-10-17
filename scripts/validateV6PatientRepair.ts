import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCase, CASE_DATA } from '../src/data/cases';
import { buildPatientDisclosureState } from '../src/lib/patientDisclosure';
import { backgroundFallback } from '../src/lib/patientBackgroundTurn';
import { validatePatientFinalResponse } from '../src/lib/patientFinalResponse';
import { assessCanonicalAssertions } from '../src/lib/patientCanonicalAssertions';
import { generatePatientRoleSafeResponse } from '../src/lib/patientRoleResponse';
import { patientImmediateResponse } from '../src/lib/patientImmediateResponse';
import { isPatientConversationClosure } from '../src/lib/patientConversationClosure';
import type { PatientDisclosureFact } from '../src/lib/patientDisclosure';

async function main(){
 const baseline=JSON.parse(readFileSync('validation/v5/unresolved-items.json','utf8'));
 const replays=[];
 for(const row of baseline){
  const c=loadCase(row.caseId)!;
  const conversation=row.setupTurns.flatMap((t:{question:string;finalResponse:string})=>[{role:'student' as const,text:t.question},{role:'patient' as const,text:t.finalResponse}]);
  const state=buildPatientDisclosureState({caseData:c,conversation,latestStudentMessage:row.question});
  const context={canonicalFacts:c.supportingInfo.patientFacts,backgroundTurn:state.backgroundTurn,latestStudentMessage:row.question};
  assert(!validatePatientFinalResponse(row.finalResponse,context).valid,`${row.testId} V5 nonpass rejected`);
  const fallback=patientImmediateResponse({caseId:row.caseId,message:row.question,disclosureState:state})??backgroundFallback(state.backgroundTurn!);
  assert(validatePatientFinalResponse(fallback,context).valid,`${row.testId}: sourced fallback ${fallback}`);
  const final=await generatePatientRoleSafeResponse({initialOutput:row.finalResponse,retry:async()=>row.finalResponse,fallbackText:fallback,validateAdditional:t=>validatePatientFinalResponse(t,context)});
  assert.equal(final.text,fallback);
  replays.push({testId:row.testId,question:row.question,oldResponse:row.finalResponse,fallback,final:final.text});
 }
 const c3=loadCase('case-03')!,facts=c3.supportingInfo.patientFacts!;
 const unsafe=["That's good to hear. My daughter's teeth need more attention, I think.","My daughter has cavities.","She needs dental work.","We'd like to stick with the same provider for consistency.","We could receive care at the same clinic as my daughter's.","It's a struggle to coordinate appointments.","Our schedules make it hard."];
 for(const t of unsafe)assert(!assessCanonicalAssertions(t,facts).valid,t);
 for(const t of ["I have a young daughter.","My daughter has Medicaid.","I'd prefer the same clinic for my daughter and me.","It would be easier if we could share a clinic.","My daughter's dental health is important to me.","We both need good care."])assert(assessCanonicalAssertions(t,facts).valid,t);
 const explicit: PatientDisclosureFact[]=[...facts,{id:'test.child-provider',topic:'dental_history',text:'The daughter has her own dentist and attends the clinic.',questionIntents:[]},{id:'test.schedule',topic:'dental_history',text:'The patient has difficulty coordinating appointment schedules.',questionIntents:[]},{id:'test.child-condition',topic:'dental_history',text:'The daughter needs more attention and dental work.',questionIntents:[]}];
 for(const t of ["My daughter's clinic is nearby.","It's a struggle to coordinate appointments.","My daughter's teeth need more attention."])assert(assessCanonicalAssertions(t,explicit).valid,`positive provenance ${t}`);
 for(const question of ["Do you see a dentist regularly?","Do you routinely visit your dentist?","How often do you visit the dentist?"]){
  const state=buildPatientDisclosureState({caseData:c3,conversation:[],latestStudentMessage:question});
  assert(state.backgroundTurn?.requests.some(r=>r.concept==='attendance'),question);
  const ctx={canonicalFacts:facts,backgroundTurn:state.backgroundTurn,latestStudentMessage:question};
  assert(!validatePatientFinalResponse('Yes, I have my own dentist and an appointment next week.',ctx).valid,question);
  assert(validatePatientFinalResponse(backgroundFallback(state.backgroundTurn!),ctx).valid,question);
 }
 assert(assessCanonicalAssertions('Yes, I visit my dentist regularly.',[...facts,{id:'test.frequency',topic:'dental_history',text:'The patient visits the dentist regularly.',questionIntents:[]}],{latestStudentMessage:'Do you see a dentist regularly?'}).valid);
 for(const c of CASE_DATA){
  for(const t of ['Without insurance, the costs will be out of pocket.',"I'll pay out of pocket.",'The bill would have to be out of pocket.'])assert(!assessCanonicalAssertions(t,c.supportingInfo.patientFacts!).valid,t);
  for(const q of ['Thank you for explaining that.','Thanks for sharing that.','Thank you very much!','That is all for now.','Goodbye.']){
   assert(isPatientConversationClosure(q));const state=buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:q});
   assert.equal(patientImmediateResponse({caseId:c.metadata.id,message:q,disclosureState:state}),"You're welcome.");
   assert(validatePatientFinalResponse("You're welcome.",{canonicalFacts:c.supportingInfo.patientFacts,latestStudentMessage:q}).valid);
   assert(!validatePatientFinalResponse('Hi. My tooth hurts. Can I get an antibiotic?',{canonicalFacts:c.supportingInfo.patientFacts,latestStudentMessage:q}).valid);
  }
 }
 for(const q of ['Thank you, but when did the pain start?','Can you tell me about your pain?','I am prescribing an antibiotic.'])assert(!isPatientConversationClosure(q),q);
 const route=readFileSync('src/app/api/conversation/route.ts','utf8');
 assert(route.includes('!isPatientConversationClosure(payload.message) && !outputRejectedByLanguageBackstop'));
 assert(route.includes('fallbackText: immediateResponse ??'));
 writeFileSync('validation/v6/focused-replays.json',JSON.stringify({at:new Date().toISOString(),sevenNonpassReplays:replays,setupFailureAndNearbyNegativeControls:unsafe,positiveControls:'Supported daughter/provider/schedule/condition/frequency facts; natural preferences, mixed clinical requests and existing patient-question validations'},null,2));
 console.log('V6 shared grounding/closure regression checks passed: all seven nonpasses, setup condition, paraphrases, supported counterexamples, repeated unsafe retry and grounded fallback/final validation.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
