import assert from "node:assert/strict";
import { parseCase3Explanations } from "../src/lib/patientQuestions/explanationScope";
import { constrainQuestionClassification } from "../src/lib/patientQuestions/eligibility";
import { applyPatientQuestionClassification } from "../src/lib/patientQuestions/stateMachine";
import { createEmptyPatientQuestionState, type Case3Explanations, type PatientQuestionClassification } from "../src/lib/patientQuestions/types";
const prior = createEmptyPatientQuestionState();
prior.detectedEvents.temporaryTreatmentActive = true;
prior.emittedQuestionIds = ["c3-follow-up-needed-question"];
const bare = "Yes, you still need to see your dentist promptly.";
function classified(message: string, proof: Case3Explanations = {}): PatientQuestionClassification {
  return constrainQuestionClassification({studentMessage:message, patientResponse:"Okay.",facts:[],conversation:[],classification:{
    schemaVersion:1,caseId:"case-03",analyzedStudentMessageId:"current",confidence:1,
    evidenceAliases:["student-current"],evidenceMessageIds:["current"],case3Explanations:proof,
    detectedEvents:{promptDentalFollowUpConfirmed:true,drainageTemporaryOrNondefinitiveExplained:true,definitiveDentalTreatmentExplained:true},
  }});
}
const apply = (classification: PatientQuestionClassification, state = prior) => applyPatientQuestionClassification({caseId:"case-03",state,classification});
assert.equal(apply(classified(bare)).selectedQuestionId,"c3-follow-up-why","bare confirmation cannot invent explanations");
const contaminated={...prior,detectedEvents:{...prior.detectedEvents,drainageTemporaryOrNondefinitiveExplained:true,definitiveDentalTreatmentExplained:true}};
assert.equal(apply(classified(bare),contaminated).selectedQuestionId,"c3-follow-up-why","legacy booleans are not validated evidence");
const temporary={messageId:"current",quote:"Drainage only eases pressure."};
const definitive={messageId:"current",quote:"Your dentist still has to take that tooth out."};
const full=`${temporary.quote} ${definitive.quote}`;
const answered=apply(classified(full,{temporary,definitive}));
assert.equal(answered.selectedQuestionId,undefined);
assert.equal(apply(classified(bare),answered.state).selectedQuestionId,undefined,"durable answered knowledge");
assert.equal(apply(classified(temporary.quote,{temporary})).selectedQuestionId,"c3-follow-up-why","temporary does not establish definitive care");
assert.equal(apply(classified(definitive.quote,{definitive})).selectedQuestionId,"c3-follow-up-why","definitive does not establish temporary explanation");
const first=apply({...classified(temporary.quote,{temporary}),detectedEvents:{drainageTemporaryOrNondefinitiveExplained:true}});
const second=apply(classified(definitive.quote,{definitive}),first.state);
assert.equal(second.selectedQuestionId,undefined,"separate supported explanations accumulate");
assert.equal(first.state.case3Explanations?.definitive,undefined,"do not mutate prior state");
assert.equal(apply(classified(bare,{temporary:{...temporary,messageId:"old"},definitive})).selectedQuestionId,"c3-follow-up-why","wrong source or nonverbatim quote vetoed");
const emitted=apply(classified(bare));
assert.equal(apply(classified(bare),emitted.state).selectedQuestionId,undefined,"once only");
assert.equal(apply(classified("Thank you for explaining that.")).selectedQuestionId,undefined,"closure stays closed");
// Unit stubs test verifier contract/isolation, not language comprehension. The
// permanent live suite supplies real semantic coverage for these clinical equivalents.
for (const quote of [definitive.quote,"The affected tooth must come out.","You still require removal of the source tooth.","Root canal treatment remains necessary."]) {
  assert.deepEqual(parseCase3Explanations({temporary:{explained:false,quote:""},definitive:{required:true,quote},confidence:1},quote,"current"),{definitive:{messageId:"current",quote}});
}

for (const output of [
  {temporary:{explained:false,quote:""},definitive:{required:true,quote:"invented extraction"},confidence:1},
  {temporary:{explained:false,quote:""},definitive:{required:true,quote:bare},confidence:0.2},
  {temporary:{explained:false,quote:""},definitive:{required:true,quote:""},confidence:1},
]) assert.throws(()=>parseCase3Explanations(output,bare,"current"));
assert.deepEqual(parseCase3Explanations({temporary:{explained:false,quote:""},definitive:{required:false,quote:""},confidence:0.2},bare,"current"),{},"no accepted reasons cannot suppress an independently eligible question");
console.log("Case3 independent evidence, verbatim witnesses, durable state, closure and once-only checks passed.");
const rejectedTrigger=apply({...classified(full,{temporary,definitive}),questionDecisionVerified:false});
assert.equal(rejectedTrigger.selectedQuestionId,undefined,"rejected trigger cannot consume a question");
assert(rejectedTrigger.state.case3Explanations?.definitive,"independent validated knowledge survives");
