import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCase } from '../src/data/cases';
import { buildPatientDisclosureState, type PatientDisclosureFact } from '../src/lib/patientDisclosure';
import { interpretBackgroundTurn, assessBackgroundAnswer, backgroundFallback } from '../src/lib/patientBackgroundTurn';
import { patientImmediateResponse, planOnlyAcknowledgment } from '../src/lib/patientImmediateResponse';
import { validatePatientFinalResponse } from '../src/lib/patientFinalResponse';
import { patientFactFallback, patientFactSentence } from '../src/lib/patientFactFallback';
import { assessCanonicalAssertions } from '../src/lib/patientCanonicalAssertions';
import { expressesRequiredFact } from '../src/lib/patientOutputGuard';
import { requiredFactsForTurn } from '../src/lib/patientTurnFacts';
import { patientAnswerWithoutQuestions, constrainQuestionClassification } from '../src/lib/patientQuestions/eligibility';
import { applyPatientQuestionClassification } from '../src/lib/patientQuestions/stateMachine';
import { type PatientQuestionClassification } from '../src/lib/patientQuestions/types';
import { generatePatientRoleSafeResponse } from '../src/lib/patientRoleResponse';
const facts=(id:string)=>loadCase(id)!.supportingInfo.patientFacts!;
const classification=(id:string):PatientQuestionClassification=>({schemaVersion:1,caseId:id,analyzedStudentMessageId:'s',detectedEvents:{painManagementOrDispositionDiscussed:id==='case-04',patientPainDescribed:id==='case-05'},confidence:1,evidenceAliases:['student-current','patient-draft'],evidenceMessageIds:['s','p']});
const qualify=(id:string,q:string,a:string,plan=false)=>constrainQuestionClassification({classification:{...classification(id),...(plan?{currentProviderAct:'current_plan' as const,currentPlanEvidence:q}:{})},studentMessage:q,patientResponse:a,conversation:[],facts:facts(id)});
async function main(){
assert.equal(planOnlyAcknowledgment({intent:'disposition_plan',hasGovernedAnswer:false,requiredFacts:[]}), 'Okay, thank you.');
for(const intent of ['question','closing','other'] as const)assert.equal(planOnlyAcknowledgment({intent,hasGovernedAnswer:false,requiredFacts:[]}),undefined);
assert.equal(planOnlyAcknowledgment({intent:'treatment_plan',hasGovernedAnswer:true,requiredFacts:[]}),undefined);
assert.equal(planOnlyAcknowledgment({intent:'medication_plan',hasGovernedAnswer:false,requiredFacts:[{id:'supported-answer'}]}),undefined);
assert.equal(patientFactSentence('The patient was nervous.'),'I was nervous.');
assert.equal(patientFactSentence('The pain wakes the patient at night.'),'The pain wakes me at night.');
assert.equal(patientFactSentence('The last dental visit was five years ago; the patient has a history of cavities.'),'The last dental visit was five years ago; I have a history of cavities.');
const corrections=JSON.parse(fs.readFileSync('validation/v6/baseline-grading-corrections.json','utf8')).corrections.filter((r:{correctedVerdict:string})=>r.correctedVerdict==='FAIL');
assert.equal(corrections.length,90);
for(const r of corrections){const c=qualify(`case-${r.testId.slice(1,3)}`,r.question,r.actualResponse);assert.equal(applyPatientQuestionClassification({caseId:`case-${r.testId.slice(1,3)}`,classification:c}).selectedQuestionId,undefined,r.testId);}
for(const [q,a] of [['Where do you live?','Duval County.'],['Could you pay a sliding-scale fee?',"I'm open to paying a sliding-scale fee."],["I'm looking into dental care options for you.",'Thank you for helping me find dental care.']])assert.equal(qualify('case-04',q,a).detectedEvents.painManagementOrDispositionDiscussed,false);
for(const q of ['I will give you ibuprofen for pain and refer you to a dentist.','For now take pain medicine; see your dentist tomorrow.'])assert.equal(applyPatientQuestionClassification({caseId:'case-04',classification:qualify('case-04',q,'Thank you.',true)} ).selectedQuestionId,'c4-antibiotic-needed-question');
for(const [q,a] of [['What does it feel like?',"It's throbbing."],['What brings you in?',"This tooth pain keeps waking me at night."],['What does it feel like?',"It's deep and throbbing."],['Where is it?',"My lower-left jaw hurts."]])assert.equal(applyPatientQuestionClassification({caseId:'case-05',classification:qualify('case-05',q,a)}).selectedQuestionId,'c5-antibiotic-request');
assert.equal(applyPatientQuestionClassification({caseId:'case-05',classification:qualify('case-05','Who do you live with?',"I'm focused on this tooth pain.")}).selectedQuestionId,undefined);
assert.equal(qualify('case-04',"I will give you ibuprofen. What county do you live in?",'Duval County.',true).detectedEvents.painManagementOrDispositionDiscussed,true);
assert.equal(patientAnswerWithoutQuestions("I live in Duval County. Do I need an antibiotic?"),'I live in Duval County.');
assert.equal(patientAnswerWithoutQuestions("It hurts. Can I get an antibiotic? It has helped in the past when I had a toothache."),'It hurts.');
for(const [id,bad]of [['case-04','It feels sharp and throbbing.'],['case-05','It feels sharp and throbbing.']])assert(!validatePatientFinalResponse(bad,{canonicalFacts:facts(id)}).valid,bad);
for(const id of ['case-04','case-05']){const q=id==='case-04'?'Describe how your tooth feels.':'What does your tooth pain feel like?';const state=buildPatientDisclosureState({caseData:loadCase(id)!,conversation:[],latestStudentMessage:q});assert(state.allowedThisTurn.some(f=>f.id===(id==='case-04'?'c4.biting':'c5.quality')));}
const first=applyPatientQuestionClassification({caseId:'case-04',classification:qualify('case-04','Do you have insurance?',"I don't have insurance.")});
assert.equal(first.state.emittedQuestionIds.length,0);
const later=applyPatientQuestionClassification({caseId:'case-04',state:first.state,classification:qualify('case-04','We will give ibuprofen and arrange dental follow-up.','Okay.',true)});
assert.equal(later.selectedQuestionId,'c4-antibiotic-needed-question');
assert.equal(applyPatientQuestionClassification({caseId:'case-04',state:later.state,classification:qualify('case-04','We will give ibuprofen.','Okay.',true)}).selectedQuestionId,undefined);
assert.equal(qualify('case-04','Thank you for explaining that.','You are welcome.').detectedEvents.painManagementOrDispositionDiscussed,false);
const old=JSON.parse(fs.readFileSync('validation/v6/results.json','utf8')) as {testId:string;caseId:string;question:string;finalResponse:string}[];
for(const id of ['C03-TARGET-6','C04-TARGET-6','C05-TARGET-6','C03-G09-H01','C01-G01-Q08']){
const r=old.find(r=>r.testId===id)!,c=loadCase(r.caseId)!;const state=buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:r.question});const good=patientImmediateResponse({caseId:r.caseId,message:r.question,disclosureState:state});assert(good,id);const context={canonicalFacts:facts(r.caseId),backgroundTurn:state.backgroundTurn,latestStudentMessage:r.question};assert(validatePatientFinalResponse(good,context).valid,`${id} ${good}`);if(id!=='C01-G01-Q08')assert(!validatePatientFinalResponse(r.finalResponse,context).valid,id);
const final=await generatePatientRoleSafeResponse({initialOutput:r.finalResponse,retry:async()=>r.finalResponse,fallbackText:good,validateAdditional:t=>validatePatientFinalResponse(t,context),allowPatientInitiatedQuestion:false});assert(validatePatientFinalResponse(final.text,context).valid,id);
}
for(const bad of ["That's good to hear. My daughter's teeth need some attention too.","That's good to hear. We both need it, especially after these recent issues."]){const q="I'm looking into dental care options for you and your daughter.",state=buildPatientDisclosureState({caseData:loadCase('case-03')!,conversation:[],latestStudentMessage:q});assert(!validatePatientFinalResponse(bad,{canonicalFacts:facts('case-03'),backgroundTurn:state.backgroundTurn,latestStudentMessage:q}).valid,bad);}
const q='What does your tooth pain feel like, and what makes it worse?',state=buildPatientDisclosureState({caseData:loadCase('case-05')!,conversation:[],latestStudentMessage:q});const required=requiredFactsForTurn(state,q,facts('case-05'));assert(required.some(f=>f.id==='c5.quality'));assert(required.some(f=>f.id==='c5.cold'));assert(!validatePatientFinalResponse('It hurts in my lower-left jaw.',{canonicalFacts:facts('case-05'),requiredFacts:required,visibleFacts:state.allowedThisTurn}).valid);
const supported:PatientDisclosureFact[]=[...facts('case-03'),{id:'test.child-condition',topic:'dental_history',text:'The daughter has cavities.'}];
assert(supported.some(f=>f.text==='The daughter has cavities.')); // Source-positive routing checked below using the same case contract.
const supportedTurn=interpretBackgroundTurn('Does your daughter have dental problems?',[],supported);assert(supportedTurn?.requests.some(r=>r.concept==='child_condition'&&r.sourceId==='test.child-condition'));
for(const question of ['Cold then stop right away or keeps hurting?','Does it stop right away after cold is removed?','Does your tooth pain stop right away after cold?']){
 const s=buildPatientDisclosureState({caseData:loadCase('case-05')!,conversation:[],latestStudentMessage:question});
 assert(!requiredFactsForTurn(s,question,facts('case-05')).some(f=>f.id==='c5.location'),question);
}
for(const question of ['Where does it hurt?','Is it on the right or left?','Which tooth hurts?']){
 const s=buildPatientDisclosureState({caseData:loadCase('case-05')!,conversation:[],latestStudentMessage:question});
 assert(requiredFactsForTurn(s,question,facts('case-05')).some(f=>f.id==='c5.location'),question);
}
for(const fact of facts('case-05').filter(f=>/^c5\.(?:location|duration|constant|quality|severity|spontaneous|nocturnal|cold|lingering|chewing|biting)$/.test(f.id)))assert(expressesRequiredFact(fact.text,fact), `Canonical positive attribute rejected: ${fact.id}`);
const bitingFact=facts('case-05').find(f=>f.id==='c5.biting')!;
for(const text of ['There is a little discomfort when I bite or tap the tooth.','Tapping causes slight discomfort.'])assert(expressesRequiredFact(text,bitingFact),text);
for(const text of ['My daughter needs a filling.','She has a toothache.','She needs treatment.',"I'm not sure, but my daughter has cavities.","I'd prefer the same clinic because my daughter has cavities."])assert(!assessCanonicalAssertions(text,facts('case-03')).valid,text);
for(const text of ["I'm not sure whether my daughter has cavities.","I'd prefer the same clinic because my daughter has Medicaid.","Her teeth are important to me.","We both need good care."])assert(assessCanonicalAssertions(text,facts('case-03')).valid,text);
assert(!assessCanonicalAssertions('It just comes and goes on its own.',facts('case-05')).valid,'Spontaneous does not establish intermittent pain');
assert(assessCanonicalAssertions("It doesn't come and go; it's constant.",facts('case-05')).valid);
for(const question of ['Does it hurt when you bite or tap the tooth?','What makes the pain worse?','Does the pain happen on its own without touching the tooth?']){
 const c=loadCase('case-05')!,state=buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:question});
 const required=requiredFactsForTurn(state,question,facts('case-05'));const fallback=patientFactFallback(state,question,facts('case-05'));
 assert(fallback,question);const context={canonicalFacts:facts('case-05'),visibleFacts:state.allowedThisTurn,requiredFacts:required,latestStudentMessage:question};
 assert(validatePatientFinalResponse(fallback,context).valid,`${question} fallback: ${fallback}`);
 const response=await generatePatientRoleSafeResponse({initialOutput:'It comes and goes.',retry:async()=> 'It comes and goes.',fallbackText:fallback,visibleFacts:state.allowedThisTurn,requiredFacts:required,validateAdditional:t=>validatePatientFinalResponse(t,context),allowPatientInitiatedQuestion:false});
 assert.equal(response.text,fallback);assert(validatePatientFinalResponse(response.text,context).valid);
}
for(const id of ['case-03','case-04']){
 const q='Does your daughter have a toothache?',c=loadCase(id)!,state=buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:q});
 assert.equal(state.backgroundTurn?.clinicalRequested,false,'Child-only clinical question is not an adult clinical question');
 const reply=patientImmediateResponse({caseId:id,message:q,disclosureState:state});assert(reply);assert(validatePatientFinalResponse(reply,{canonicalFacts:facts(id),backgroundTurn:state.backgroundTurn,latestStudentMessage:q}).valid,`${id} ${reply}`);
 if(id==='case-04')assert(!reply.includes('my daughter'));
}
const coldFact=facts('case-05').find(f=>f.id==='c5.cold')!;
const lingerFact=facts('case-05').find(f=>f.id==='c5.lingering')!;
assert(!validatePatientFinalResponse('The pain lingers after I remove the cold drink.',{canonicalFacts:facts('case-05'),visibleFacts:[coldFact,lingerFact],requiredFacts:[coldFact,lingerFact]}).valid,'Cold/pain co-occurrence is not an assertion that cold worsens pain');
assert(validatePatientFinalResponse('The pain lingers after I remove the cold drink.',{canonicalFacts:facts('case-05'),visibleFacts:[lingerFact],requiredFacts:[lingerFact]}).valid,'A persistence-only answer remains valid when only persistence is requested');
for(const t of ['Cold drinks make the pain worse.','Cold worsens it.','It gets worse when I drink something cold.','It hurts when I drink cold water.','Cold drinks make the tooth hurt.'])assert(validatePatientFinalResponse(t,{canonicalFacts:facts('case-05'),visibleFacts:[coldFact],requiredFacts:[coldFact]}).valid,t);
for(const good of ["Cold drinks make the pain worse. The pain does not stop immediately after the cold is removed; it keeps hurting for a little while afterward.","The pain doesn't stop right away after cold; it lingers."])assert(validatePatientFinalResponse(good,{canonicalFacts:facts('case-05'),visibleFacts:facts('case-05')}).valid,good);
for(const bad of ["Cold doesn't hurt.","The pain stops immediately after cold is removed.","It goes away right away after cold."])assert(!validatePatientFinalResponse(bad,{canonicalFacts:facts('case-05'),visibleFacts:facts('case-05')}).valid,bad);
fs.writeFileSync('validation/v8/prior-v7-regressions.json',JSON.stringify({at:new Date().toISOString(),priorTimingCorrections:90,passed:true,coverage:['source-scoped offers','both V6 regressions','setup FAIL/REVIEW','production compound pain and payment','opening and later pain','once only','eligibility after withholding','repeated unsafe retry and fallback','source-positive child condition']},null,2));console.log('V7 focused regressions passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});



const compoundChild = interpretBackgroundTurn("Does your daughter have Medicaid, and does she have a toothache?", [], facts('case-03'))!;
assert(assessBackgroundAnswer(backgroundFallback(compoundChild), compoundChild).valid, 'Known coverage plus unknown child condition survives separate clauses');
assert(assessBackgroundAnswer("My daughter has Medicaid. I'm not sure whether she has cavities.", compoundChild).valid);
assert(!assessBackgroundAnswer("My daughter does not have Medicaid. I'm not sure about her dental condition.", compoundChild).valid);
assert(!assessBackgroundAnswer("I'm not sure whether my daughter has Medicaid. I'm not sure about her dental condition.", compoundChild).valid);

