import assert from "node:assert/strict";
import path from "node:path";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, { alias: {
  "server-only": path.resolve("scripts/fixtures/serverOnlyStub.mjs"),
  "@/lib/persistence/repositories/prisma": path.resolve("scripts/fixtures/case3QuestionStore.mjs"),
  "@": path.resolve("src"),
} });
const { PatientQuestionService } = await jiti.import("../src/lib/persistence/services/patientQuestionService.ts");
const { classifyPatientQuestionTrigger } = await jiti.import("../src/lib/patientQuestions/classifier.ts");
const { createEmptyPatientQuestionState } = await jiti.import("../src/lib/patientQuestions/types.ts");
const repository = await jiti.import("./fixtures/case3QuestionStore.mjs");
const service = new PatientQuestionService();
const prior = createEmptyPatientQuestionState();
prior.version = 4; prior.detectedEvents.temporaryTreatmentActive = true;
prior.emittedQuestionIds = ["c3-follow-up-needed-question"];
repository.reset(prior);
const message = "Yes, you still need to see your dentist promptly.";
const events = { promptDentalFollowUpConfirmed: true, drainageTemporaryOrNondefinitiveExplained: true, definitiveDentalTreatmentExplained: true };
const classified = await classifyPatientQuestionTrigger({ caseId:"case-03", state:prior,
  studentMessageId:"current",studentMessage:message,draftPatientMessageId:"draft",
  draftPatientResponse:"Okay, I'll keep my appointment.", conversation:[],
  provider:{name:"synthetic-false-explanation-classifier",generateText:async () => ({text:JSON.stringify({schemaVersion:1,caseId:"case-03",events,confidence:0.99,evidence:["student-current"]})})},
});
assert(classified.success);
assert.deepEqual(classified.classification.detectedEvents,{...events,drainageTemporaryOrNondefinitiveExplained:false,definitiveDentalTreatmentExplained:false});
const raw = {...classified.classification,detectedEvents:events};
const input = {userId:"synthetic",encounterId:"encounter",caseId:"case-03",requestId:"request",
  studentMessageId:"current",patientMessageId:"patient",baseResponse:"Okay, I'll keep my appointment.",
  providerName:"synthetic",classification:raw,questionEvidence:{studentMessage:message,conversation:[]},questionText:()=>"Why?"};
await assert.rejects(service.finalizeTurn({...input,validateFinalResponse:()=>{throw Error("synthetic rejection");}}));
assert.deepEqual(repository.saved,{state:prior,turns:[],emissions:[]},"rejected final assembly must not consume Why");
const accepted=await service.finalizeTurn(input);
assert.equal(accepted.selectedQuestionId,"c3-follow-up-why");
assert.equal(accepted.responseText,"Okay, I'll keep my appointment. Why?");
const snapshot=JSON.stringify(repository.saved);
assert.deepEqual(await service.finalizeTurn(input),accepted,"same-request replay");
assert.equal(JSON.stringify(repository.saved),snapshot);
const later=await service.finalizeTurn({...input,requestId:"later"});
assert.equal(later.selectedQuestionId,undefined);assert.equal(repository.saved.emissions.length,1);
repository.reset(prior);
const alreadyAnswered=await service.finalizeTurn({...input,questionEvidence:{studentMessage:"Drainage is temporary. You still need root canal treatment or extraction.",conversation:[]}});
assert.equal(alreadyAnswered.selectedQuestionId,undefined,"genuinely answered Why remains suppressed");
assert.equal(repository.saved.emissions.length,0);
console.log("Case3 classifier and real final-assembly service: false flags, validation rejection, retry, idempotency, once-only and answered control passed (in-memory repository, no DB).");
