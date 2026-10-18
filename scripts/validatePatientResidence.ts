import assert from "node:assert/strict";
import { CASE_DATA } from "../src/data/cases";
import { buildPatientDisclosureState, classifyQuestion } from "../src/lib/patientDisclosure";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";
import { requiredFactsForTurn } from "../src/lib/patientTurnFacts";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";

const counties = ["Alachua", "Collier", "Hillsborough", "Duval", "Marion"];
const clinicalAnswers = [
  "The painful tooth is my lower-left molar.",
  "The painful tooth is the back upper-right molar.",
  "The pain is in my lower-right back tooth.",
  "The pain is in a molar on my lower-left side.",
  "It hurts in the lower-left side of my jaw, but I can't tell which tooth is causing it.",
];

async function validate() {
  let residenceChecks = 0;
  let clinicalChecks = 0;
  for (const [index, entry] of CASE_DATA.entries()) {
    const canonicalFacts = entry.supportingInfo.patientFacts ?? [];
    const locationId = `c${index + 1}.location`;
    for (const question of ["Where do you live?", "What county do you live in?", "Where are you living?"]) {
      // Check both a fresh conversation and one where tooth location is already known.
      for (const hasHistory of [false, true]) {
        const classification = classifyQuestion(question);
        assert(classification.questionIntents.includes("background_residence"), question);
        assert(!classification.questionIntents.includes("location"), question);
        assert(!classification.topics.includes("location"), question);
        const disclosure = buildPatientDisclosureState({
          caseData: entry,
          conversation: hasHistory ? [{ id: "prior-patient", role: "patient", text: clinicalAnswers[index], timestamp: "2026-10-16T00:00:00Z" }] : [],
          latestStudentMessage: question,
        });
        assert.deepEqual(disclosure.allowedThisTurn.map((fact) => fact.id), [`c${index + 1}.background-residence`]);
        assert.match(disclosure.allowedThisTurn[0].text, new RegExp(`${counties[index]} County`));
        assert.equal(patientImmediateResponse({ caseId: entry.metadata.id, message: question, disclosureState: disclosure }), undefined);
        const required = requiredFactsForTurn(disclosure, question, canonicalFacts);
        assert(!required.some((fact) => fact.id === locationId), "Residence must not force clinical fallback");
        const answer = index === 1
          ? "I live in Collier County, but I haven't established residency yet."
          : `I live in ${counties[index]} County.`;
        const safe = await generatePatientRoleSafeResponse({
          initialOutput: answer,
          visibleFacts: [...canonicalFacts, ...disclosure.alreadyDisclosed, ...disclosure.allowedThisTurn],
          requiredFacts: required,
          allowPatientInitiatedQuestion: false,
          fallbackText: clinicalAnswers[index],
          retry: async () => { throw new Error("A correct residence answer must not trigger corrective retry"); },
        });
        assert.equal(safe.text, answer);
        assert.equal(safe.repeatedDrift, false);
        residenceChecks++;
      }
    }
    for (const question of ["Where does it hurt?", "Which tooth hurts?"]) {
      const classification = classifyQuestion(question);
      assert(classification.questionIntents.includes("location"), question);
      assert(!classification.questionIntents.includes("background_residence"), question);
      const disclosure = buildPatientDisclosureState({ caseData: entry, conversation: [], latestStudentMessage: question });
      assert(disclosure.allowedThisTurn.some((fact) => fact.id === locationId), question);
      assert(!disclosure.allowedThisTurn.some((fact) => fact.id.includes(".background-")), question);
      const required = requiredFactsForTurn(disclosure, question, canonicalFacts);
      assert(required.some((fact) => fact.id === locationId), "Clinical location must still be enforced");
      assert(assessPatientOutputIntegrity(clinicalAnswers[index], canonicalFacts, [], required).valid);
      clinicalChecks++;
    }
  }
  const mixed = classifyQuestion("What county do you live in, and which tooth hurts?");
  assert(mixed.questionIntents.includes("background_residence"));
  assert(mixed.questionIntents.includes("location"));
  console.log(`Patient residence validation passed (${residenceChecks} residence/history checks, ${clinicalChecks} clinical location checks, mixed intent preserved).`);
}

void validate();
