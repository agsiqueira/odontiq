import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCase } from '../src/data/cases';
import { buildPatientDisclosureState, isPatientPainSeverityQuestion } from '../src/lib/patientDisclosure';
import { requiredFactsForTurn } from '../src/lib/patientTurnFacts';
import { patientRequestedText } from '../src/lib/providerTurnScopes';
import { assessClinicalPlanWitness } from '../src/lib/patientQuestions/clinicalPlan';
import { constrainQuestionClassification, patientAnswerWithoutQuestions } from '../src/lib/patientQuestions/eligibility';
import { applyPatientQuestionClassification } from '../src/lib/patientQuestions/stateMachine';
import { createEmptyPatientQuestionState, type PatientQuestionClassification } from '../src/lib/patientQuestions/types';
import { generatePatientRoleSafeResponse } from '../src/lib/patientRoleResponse';
const negative=[
'Is sliding scale payment something you open to?', 'Would fees adjusted to income work for you?',
'Are you willing to pay for pain medication?', 'Do you have insurance for a dental referral?',
'I will look for affordable dental clinics.', 'I recommend exploring sliding-scale dental clinics.',
'We could refer you to a dentist if a clinic becomes available.', 'If I recommended ibuprofen, would you take it?',
'Would seeing a dentist be an affordable option?', 'If we find a free clinic, could you go?',
'I recommend paying for pain relief.', 'We will arrange payment for a dental visit.', 'I will arrange payment for a dentist.', 'We will schedule a payment for dental care.',
'You could pay for dental treatment on a sliding scale.', 'Have you tried ibuprofen for pain?',
'Is ibuprofen something you would be willing to pay for?', 'I might prescribe ibuprofen.',
'Insurance might cover a dentist. Would that help?', 'Suppose we referred you to a dentist.',
'What if we use ibuprofen for pain?', 'Would you prefer an insured appointment or a sliding fee?',
];
const positive=[
'I will give you ibuprofen for pain.', "I'm referring you to a dentist for follow-up.",
'For now take pain medicine; see your dentist tomorrow.', 'I recommend acetaminophen for pain relief.',
'You should see a dentist within three days.', 'Please take ibuprofen for relief.',
'We are going to manage your pain here.', 'Your next step is a dentist within three days.',
'I recommend that you see a dentist.', 'I will refer you to a sliding-fee dental clinic.', 'We will arrange an appointment with a dentist.', "We'll provide pain medication and refer you to a dentist.",
'I will give you ibuprofen. Are you open to a sliding-scale fee?',
'Do you have insurance? We will refer you to a dentist tomorrow.',
'If the pain worsens, take ibuprofen for relief.',
'I recommend ibuprofen for pain, but would a free clinic work for you?',
];
const classification=(q:string):PatientQuestionClassification=>({schemaVersion:1,caseId:'case-04',analyzedStudentMessageId:'s',confidence:1,evidenceAliases:['student-current'],evidenceMessageIds:['s'],currentProviderAct:'current_plan',currentPlanEvidence:q,detectedEvents:{painManagementOrDispositionDiscussed:true,antibioticsRecommended:false,antibioticsNotIndicatedExplained:false}});
const constrain=(q:string)=>constrainQuestionClassification({classification:classification(q),studentMessage:q,patientResponse:'Okay.',conversation:[],facts:[]});
for(const q of negative){assert(!assessClinicalPlanWitness(q,q).valid,q);assert.equal(applyPatientQuestionClassification({caseId:'case-04',classification:constrain(q)}).selectedQuestionId,undefined,q);}
for(const q of positive){assert(assessClinicalPlanWitness(q,q).valid,q);assert.equal(applyPatientQuestionClassification({caseId:'case-04',classification:constrain(q)}).selectedQuestionId,'c4-antibiotic-needed-question',q);}
assert(!assessClinicalPlanWitness('I recommend ibuprofen.','ibuprofen').valid,'Topic fragment is not a directive');
assert(!assessClinicalPlanWitness('Would you pay?','I recommend ibuprofen.').valid,'Quote must come from current turn');
let state=createEmptyPatientQuestionState();
for(const q of negative){const t=applyPatientQuestionClassification({caseId:'case-04',state,classification:constrain(q)});assert(!t.selectedQuestionId);assert.equal(t.state.detectedEvents.painManagementOrDispositionDiscussed,false);assert.deepEqual(t.state.emittedQuestionIds,[]);state=t.state;}
const eligible=applyPatientQuestionClassification({caseId:'case-04',state,classification:constrain(positive[0])});assert.equal(eligible.selectedQuestionId,'c4-antibiotic-needed-question');assert.deepEqual(state.emittedQuestionIds,[],'Transition does not mutate persisted previous state');
const repeated=applyPatientQuestionClassification({caseId:'case-04',state:eligible.state,classification:constrain(positive[1])});assert.equal(repeated.selectedQuestionId,undefined,'Once only');
const stale=createEmptyPatientQuestionState();stale.detectedEvents.painManagementOrDispositionDiscussed=true;const cleared=applyPatientQuestionClassification({caseId:'case-04',state:stale,classification:constrain(negative[0])});assert.equal(cleared.selectedQuestionId,undefined);assert.equal(cleared.state.detectedEvents.painManagementOrDispositionDiscussed,false);
assert.equal(patientAnswerWithoutQuestions("I'm open to a sliding-scale fee. Do I need an antibiotic?"),"I'm open to a sliding-scale fee.");
const mixed = 'I will give you ibuprofen for pain. Would a sliding-scale fee be acceptable?';
assert.equal(patientRequestedText(mixed), 'Would a sliding-scale fee be acceptable?');
assert(!isPatientPainSeverityQuestion(mixed));
for (const id of ['case-01','case-02','case-03','case-04','case-05']) {
 const turn = buildPatientDisclosureState({caseData:loadCase(id)!,conversation:[],latestStudentMessage:mixed});
 assert(!turn.backgroundTurn?.clinicalRequested, id);
 assert(!turn.allowedThisTurn.some(f=>f.topic==='pain'), id);
 assert(!requiredFactsForTurn(turn,mixed,loadCase(id)!.supportingInfo.patientFacts).some(f=>f.topic==='pain'), id);
}
for(const q of ['I will give you ibuprofen for pain. How severe is your pain?', 'Do you have insurance, and how severe is your pain?', 'How severe is your pain on a scale of ten?']) {
 assert(isPatientPainSeverityQuestion(q),q);
 const turn=buildPatientDisclosureState({caseData:loadCase('case-04')!,conversation:[],latestStudentMessage:q});
 assert(turn.allowedThisTurn.some(f=>f.id==='c4.severity'),q);
}
assert.equal(patientRequestedText('If we could refer you to a dentist, would that be an option?'),'If we could refer you to a dentist, would that be an option?');
async function main(){
let calls=0;
const stripped=await generatePatientRoleSafeResponse({initialOutput:"I'm open to paying a sliding-scale fee. Do I need an antibiotic?",retry:async()=>{throw Error('Valid answer should be preserved without retry');},allowPatientInitiatedQuestion:false});
assert.equal(stripped.text,"I'm open to paying a sliding-scale fee.");
const result=await generatePatientRoleSafeResponse({initialOutput:'As a dentist, I recommend a root canal.',retry:async()=>{calls++;return 'As a dentist, I recommend a root canal.';},fallbackText:"I'm open to paying a sliding-scale fee.",allowPatientInitiatedQuestion:false});
assert.equal(result.text,"I'm open to paying a sliding-scale fee.");assert.equal(calls,1);assert(result.repeatedDrift);
assert.equal(constrain(negative[0]).detectedEvents.painManagementOrDispositionDiscussed,false);
fs.writeFileSync('validation/v8/focused-regressions.json',JSON.stringify({at:new Date().toISOString(),passed:true,negativeCases:negative,positiveCases:positive,coverage:['scope/clinical action','mixed messages','hypothetical versus actual','stale state','later eligibility','once only','input immutability','unsafe generation question stripping','repeated unsafe generation and actual fallback']},null,2));console.log('V8 boundary regressions passed.');}
main().catch(e=>{console.error(e);process.exitCode=1;});
