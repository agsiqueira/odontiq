import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CASE_DATA } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { requiredFactsForTurn } from "../src/lib/patientTurnFacts";
import { residenceCounty, residenceFallback } from "../src/lib/patientResidence";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";
import { assertPatientFinalResponse } from "../src/lib/patientFinalResponse";
import { PATIENT_QUESTION_CATALOG } from "../src/lib/patientQuestions/catalog";

async function validate() {
  let checks = 0;
  for (const entry of CASE_DATA) {
    const residence = entry.supportingInfo.patientFacts!.find(fact => fact.id.endsWith(".background-residence"))!;
    const county = residenceCounty(residence)!;
    const answer = `I live in ${county}.`;
    for (const question of ["Where do you live?", "What county do you live in?", "Where are you living?", "Which county is home for you?"]) {
      const state = buildPatientDisclosureState({ caseData: entry, latestStudentMessage: question, conversation: [
        { id: "p1", role: "patient", text: answer, timestamp: "2026-10-16T00:00:00Z" },
        { id: "p2", role: "patient", text: `${answer} Do I need an antibiotic?`, timestamp: "2026-10-16T00:01:00Z" },
      ] });
      const required = requiredFactsForTurn(state, question, entry.supportingInfo.patientFacts);
      assert(required.some(fact => fact.id === residence.id));
      const context = { visibleFacts: entry.supportingInfo.patientFacts, requiredFacts: required };
      // Actual forms captured in the diagnostic replay must keep the county,
      // while unapproved questions remain controlled by the state machine.
      for (const extra of ["Is this tooth saveable?", "Can you tell me what's wrong with my tooth?"]) {
        const result = await generatePatientRoleSafeResponse({ initialOutput: `${answer} ${extra}`,
          ...context, allowPatientInitiatedQuestion: false,
          retry: async () => { throw Error("Correct factual statement should be retained without a retry"); } });
        assert.equal(result.text, answer);
        assertPatientFinalResponse(`${result.text} Do I need an antibiotic?`, context);
        checks++;
      }
      const fallback = residenceFallback(state.allowedThisTurn).join(" ");
      const recovered = await generatePatientRoleSafeResponse({ initialOutput: "Is this tooth saveable?",
        retry: async () => "Can I get an antibiotic?", fallbackText: fallback,
        ...context, allowPatientInitiatedQuestion: false });
      assert(recovered.text.includes(county));
      assertPatientFinalResponse(recovered.text, context);
      assert.throws(() => assertPatientFinalResponse("I'm not sure about that.", context));
      assert.throws(() => assertPatientFinalResponse("I live in Orange County.", context));
      assert.throws(() => assertPatientFinalResponse(`${answer} I'm keeping it brief.`, context));
      if (entry.metadata.id === "case-02") assert.match(fallback, /haven't established residency/);
    }
  }
  const service = readFileSync("src/lib/persistence/services/patientQuestionService.ts", "utf8");
  for (const question of PATIENT_QUESTION_CATALOG) {
    const entry = CASE_DATA.find(item => item.metadata.id === question.caseId)!;
    const residence = entry.supportingInfo.patientFacts!.find(fact => fact.id.endsWith(".background-residence"))!;
    assertPatientFinalResponse(`${residenceFallback([residence])[0]} ${question.text}`, {
      visibleFacts: entry.supportingInfo.patientFacts, requiredFacts: [residence],
    });
  }
  const assembly = service.indexOf("const responseText = questionText");
  const validation = service.indexOf("input.validateFinalResponse?.(responseText)");
  assert(assembly < validation && validation < service.indexOf("await transaction.patientQuestionState.upsert"));
  console.log(`Residence recovery validation passed (${checks} captured-output variants, all five counties, fact-backed fallback, final assembly facts/leakage).`);
}
void validate();
