import assert from "node:assert/strict";
import { constrainQuestionClassification } from "../src/lib/patientQuestions/eligibility";
import { applyPatientQuestionClassification } from "../src/lib/patientQuestions/stateMachine";
import { createEmptyPatientQuestionState, type PatientQuestionClassification } from "../src/lib/patientQuestions/types";

const prior = createEmptyPatientQuestionState();
prior.version = 4;
prior.detectedEvents.temporaryTreatmentActive = true;
prior.emittedQuestionIds = ["c3-follow-up-needed-question"];
// Reconstructed production flags, not a claim to have retained the raw model JSON.
const asserted: PatientQuestionClassification = {
  schemaVersion: 1, caseId: "case-03", analyzedStudentMessageId: "current",
  detectedEvents: { promptDentalFollowUpConfirmed: true,
    drainageTemporaryOrNondefinitiveExplained: true, definitiveDentalTreatmentExplained: true },
  confidence: 0.99, evidenceAliases: ["student-current"], evidenceMessageIds: ["current"],
};
function classify(message: string, classification = asserted) {
  return constrainQuestionClassification({ classification, studentMessage: message,
    patientResponse: "Okay, I'll keep my appointment.", facts: [], conversation: [
      { id: "prior-plan", role: "student", text: "I recommend drainage to relieve the pressure.", timestamp: "2026-10-18T00:00:00Z" },
      { id: "prior-patient", role: "patient", text: "Even with this treatment, do I still need to see my dentist soon?", timestamp: "2026-10-18T00:00:01Z" },
    ] });
}
function selected(message: string, classification = asserted) {
  return applyPatientQuestionClassification({ caseId: "case-03", state: prior,
    classification: classify(message, classification) });
}
const bare = "Yes, you still need to see your dentist promptly.";
assert.equal(selected(bare).selectedQuestionId, "c3-follow-up-why", "production omission must reproduce before the fix");
for (const message of [bare, "Please arrange an urgent dental appointment.",
  "Yes, please keep that appointment.", "You need dental follow-up as soon as possible.",
  "Drainage only relieves pressure. You still need to see a dentist.",
  "You still need a root canal. Please see your dentist soon.",
  "You need to see your dentist. Have you had a root canal before?",
  "You still need prompt dental care. In the past, extraction was discussed.",
  "You still need a dentist. If it gets worse, you might need an extraction.",
  "You still need a dentist. You do not need a root canal.",
  "Drainage is temporary. Your dentist can discuss root canal treatment with you.",
  "Drainage is temporary. A root canal is not required.",
  "Drainage only relieves pressure. No root canal is needed.",
]) assert.equal(selected(message).selectedQuestionId, "c3-follow-up-why", message);

for (const message of [
  "Drainage only relieves pressure. You still need root canal treatment or extraction.",
  "The I&D is temporary; definitive dental treatment is still required.",
  "Draining the abscess does not fix the tooth. Your dentist must treat the underlying cause.",
  "Drainage does not replace the need for a root canal. You still need definitive treatment.",
]) assert.equal(selected(message).selectedQuestionId, undefined, message);

// A prior complete explanation must not masquerade as a CURRENT explanation.
const contaminated = { ...prior, detectedEvents: { ...prior.detectedEvents,
  definitiveDentalTreatmentExplained: true, drainageTemporaryOrNondefinitiveExplained: true } };
assert.equal(applyPatientQuestionClassification({caseId:"case-03", state:contaminated,
  classification:classify(bare)}).selectedQuestionId,"c3-follow-up-why");
const why = selected(bare);
assert.equal(applyPatientQuestionClassification({caseId:"case-03",state:why.state,
  classification:classify(bare)}).selectedQuestionId,undefined,"once-only emission");
assert.equal(selected(bare,{...asserted,detectedEvents:{...asserted.detectedEvents,
  promptDentalFollowUpConfirmed:false}}).selectedQuestionId,undefined,"do not grant an unclassified prerequisite");
assert.equal(selected("Thank you for explaining that.").selectedQuestionId,undefined,"closure stays closed");
assert.equal(selected(bare,{...asserted,evidenceAliases:["student-prior-1"],
  evidenceMessageIds:["prior-plan"]}).selectedQuestionId,undefined,"prior evidence cannot confirm the current follow-up");
assert.deepEqual(asserted.detectedEvents,{promptDentalFollowUpConfirmed:true,
  drainageTemporaryOrNondefinitiveExplained:true,definitiveDentalTreatmentExplained:true},"input immutable");
console.log("Case3 explanation scope: production replay, paraphrases, suppression controls, provenance and once-only checks passed.");
