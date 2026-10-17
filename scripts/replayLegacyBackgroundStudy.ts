import { readFileSync, writeFileSync } from "node:fs";
import { CASE_DATA } from "../src/data/cases";
import { classifyQuestion, extractPatientFacts, selectAllowedFacts, type PatientDisclosureState } from "../src/lib/patientDisclosure";
import { requiredFactsForTurn } from "../src/lib/patientTurnFacts";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { assessPatientRole } from "../src/lib/patientRoleGuard";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";

const baseline = JSON.parse(readFileSync("validation/question-variations-2026-10-17/primary-results.json", "utf8"));
const ids = ["C01-G02-Q12", "C01-G02-Q14", "C01-G03-Q09", "C01-G03-Q11", "C02-G05-Q02", "C02-G06-Q18", "C03-G09-Q01", "C03-G09-Q04", "C03-G10-Q01", "C03-G10-Q17", "C04-G14-Q13", "C05-G17-Q03", "C05-G17-Q12"];
const rows = ids.map(testId => {
  const recorded = baseline.find((r: { testId: string }) => r.testId === testId);
  const c = CASE_DATA.find(c => c.metadata.id === recorded.caseId)!;
  const classification = classifyQuestion(recorded.question);
  const selected = selectAllowedFacts({ caseId: c.metadata.id, facts: extractPatientFacts(c), classification, disclosedFactIds: new Set(), question: recorded.question });
  const state: PatientDisclosureState = { alreadyDisclosed: [], allowedThisTurn: selected, latestTopics: classification.topics, isBroadQuestion: classification.isBroadQuestion, asksRestrictedClinicalInterpretation: classification.asksRestrictedClinicalInterpretation, providerMessageIntent: classification.providerMessageIntent };
  const required = requiredFactsForTurn(state, recorded.question, c.supportingInfo.patientFacts);
  return {
    testId, historical: { question: recorded.question, finalResponse: recorded.finalResponse, encounterId: recorded.encounterId, requestId: recorded.requestId, outcome: recorded.outcome },
    reconstructedLegacyPath: { classification, selectedFacts: selected.map(({ id, topic, text }) => ({ id, topic, text })), requiredFacts: required, promptBoundaryInputs: { alreadyDisclosed: state.alreadyDisclosed, newInformation: state.allowedThisTurn.map(f => f.text), restrictedClinicalInterpretation: state.asksRestrictedClinicalInterpretation }, immediate: patientImmediateResponse({ caseId: c.metadata.id, message: recorded.question, disclosureState: state }) ?? null, roleAssessmentOfRecordedFinal: assessPatientRole(recorded.finalResponse), integrityAssessmentOfRecordedFinal: assessPatientOutputIntegrity(recorded.finalResponse, c.supportingInfo.patientFacts ?? [], recorded.setupTurns.map((t: {finalResponse: string}) => t.finalResponse), required) },
  };
});
writeFileSync("validation/shared-conversation-repair-2026-10-17/reconstructed-legacy-replays.json", JSON.stringify({ method: "Deterministic reconstruction using retained lexical classifyQuestion/selectAllowedFacts and pre-contract required/guard paths, deliberately omitting backgroundTurn. Not an archived pre-change binary or a historical provider trace. Fresh-turn selection uses empty inferred-disclosure IDs; recorded setup dialogue is supplied only to integrity checks. Prompt boundary inputs are reconstructed, not the original full prompt. No Navigator call or historical model/retry/fallback content is inferred.", rows }, null, 2));
for (const r of rows) console.log(JSON.stringify({ id: r.testId, intents: r.reconstructedLegacyPath.classification.questionIntents, restricted: r.reconstructedLegacyPath.classification.asksRestrictedClinicalInterpretation, selected: r.reconstructedLegacyPath.selectedFacts.map(f => f.id), required: r.reconstructedLegacyPath.requiredFacts.map(f => f.id), recordedFinalAcceptedInReconstruction: r.reconstructedLegacyPath.integrityAssessmentOfRecordedFinal }));
