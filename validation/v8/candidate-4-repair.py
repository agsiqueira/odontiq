from pathlib import Path
p=Path('src/lib/patientQuestions/stateMachine.ts');s=p.read_text();needle='''  // Case 4's plan event is current-turn evidence, never a durable unlock.''';insert='''  // Proposed-and-agreed drainage is an explicit Case 3 temporary treatment.
  // Preserve that logical implication even if the classifier's redundant summary
  // flag is inconsistent. Either fact alone is insufficient for this implication.
  if (input.caseId === "case-03" && detectedEvents.incisionAndDrainageProposed
    && detectedEvents.patientAgreedToIncisionAndDrainage) detectedEvents.temporaryTreatmentActive = true;
''';assert needle in s;s=s.replace(needle,insert+needle);p.write_text(s)
p=Path('scripts/validateV8PatientRepair.ts');s=p.read_text();needle='async function main(){';insert='''const drainage=(proposed:boolean,agreed:boolean):PatientQuestionClassification=>({...classification('I recommend drainage.'),caseId:'case-03',detectedEvents:{temporaryTreatmentActive:false,incisionAndDrainageProposed:proposed,patientAgreedToIncisionAndDrainage:agreed}});
for(const [proposed,agreed]of [[false,false],[true,false],[false,true]])assert.equal(applyPatientQuestionClassification({caseId:'case-03',classification:drainage(proposed,agreed)}).selectedQuestionId,undefined);
const consentTransition=applyPatientQuestionClassification({caseId:'case-03',classification:drainage(true,true)});
assert.equal(consentTransition.selectedQuestionId,'c3-follow-up-needed-question');
assert.equal(consentTransition.state.detectedEvents.temporaryTreatmentActive,true);
assert.equal(applyPatientQuestionClassification({caseId:'case-03',state:consentTransition.state,classification:drainage(true,true)}).selectedQuestionId,undefined);
const proposalState=applyPatientQuestionClassification({caseId:'case-03',classification:drainage(true,false)}).state;
assert.equal(applyPatientQuestionClassification({caseId:'case-03',state:proposalState,classification:drainage(false,true)}).selectedQuestionId,'c3-follow-up-needed-question');
''';s=s.replace(needle,insert+needle);p.write_text(s)
