import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PATIENT_QUESTION_CATALOG } from "../src/lib/patientQuestions/catalog";

const APPROVED_TONE_INSTRUCTION =
  "Speak naturally as a tired, uncomfortable patient under stress. Usually answer concisely, with limited patience and occasional curt or mildly irritable phrasing. Convey this through rhythm and word choice rather than repeatedly naming the emotion. Remain cooperative, believable, and non-abusive. Do not alter, add, anticipate, or withhold clinical facts, and continue to follow all case-specific disclosure and safety rules.";

const readSource = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const [conversationRoute, questionCatalog, appShell, consultation] =
  await Promise.all([
    readSource("src/app/api/conversation/route.ts"),
    readSource("src/lib/patientQuestions/catalog.ts"),
    readSource("src/components/AppShell.tsx"),
    readSource("src/components/EncounterExperience.tsx"),
  ]);

assert.equal(
  conversationRoute.split(APPROVED_TONE_INSTRUCTION).length - 1,
  1,
  "The approved tone instruction must occur exactly once in the production conversation prompt.",
);

const sharedPromptIndex = conversationRoute.indexOf(
  "const PATIENT_ROLE_SYSTEM_PROMPT",
);
const toneIndex = conversationRoute.indexOf(APPROVED_TONE_INSTRUCTION);
const promptEndIndex = conversationRoute.indexOf(
  "Return only the patient response text.`;",
);
assert(
  sharedPromptIndex < toneIndex && toneIndex < promptEndIndex,
  "The tone instruction must remain inside the shared patient-role system prompt.",
);

for (const protectedInstruction of [
  "Use only the patient facts provided in the prompt context. Do not infer, invent, or volunteer clinical findings that are not provided.",
  "If the student asks for a diagnosis, clinical interpretation, management plan, or what the dentist should do, do not diagnose or teach.",
  "Only reveal symptoms, history, medications, allergies, dental history, social history, and examination-related information when the student asks an appropriate question about that topic.",
  "If no new information is permitted, answer naturally without adding clinical facts.",
  "Permitted response to the restricted clinical question: \"I don't know, that's why I'm here.\"",
]) {
  assert(
    conversationRoute.includes(protectedInstruction),
    `Protected disclosure or unsupported-question instruction changed: ${protectedInstruction}`,
  );
}

const composedPromptIndex = conversationRoute.indexOf(
  "PATIENT_ROLE_SYSTEM_PROMPT,",
  promptEndIndex,
);
const permittedFactsIndex = conversationRoute.indexOf(
  '"Use only the new information explicitly permitted below',
  composedPromptIndex,
);
const caseContextIndex = conversationRoute.indexOf(
  "buildPatientContextText(patientCase, disclosureState)",
  permittedFactsIndex,
);
assert(
  composedPromptIndex < permittedFactsIndex &&
    permittedFactsIndex < caseContextIndex,
  "Per-turn disclosure and case context must remain composed after the shared tone instruction.",
);

assert.deepEqual(
  PATIENT_QUESTION_CATALOG.map(({ id, text }) => ({ id, text })),
  [
    { id: "c1-extraction-question", text: "Will they pull out the bad tooth?" },
    { id: "c2-antibiotic-effect-question", text: "Will the antibiotic make the tooth better?" },
    { id: "c3-follow-up-needed-question", text: "Even with this treatment, do I still need to see my dentist soon?" },
    { id: "c3-follow-up-why", text: "Why?" },
    { id: "c4-antibiotic-needed-question", text: "Do I need an antibiotic?" },
    { id: "c5-antibiotic-request", text: "Can I get an antibiotic? It has helped in the past when I had a toothache." },
  ],
);
assert.equal(
  questionCatalog.includes(APPROVED_TONE_INSTRUCTION),
  false,
  "The tone instruction must not be duplicated into fixed patient questions.",
);

for (const caseId of ["01", "02", "03", "04", "05"]) {
  const caseSource = await readSource(`src/data/cases/case-${caseId}/case.json`);
  assert.equal(
    caseSource.includes(APPROVED_TONE_INSTRUCTION),
    false,
    `The shared tone instruction must not be duplicated into case-${caseId}.`,
  );
}

assert.match(appShell, /max-w-\[30rem\][^"\n]*md:max-w-\[48rem\]/);
assert.match(
  consultation,
  /max-w-\[30rem\][^"\n]*md:max-w-\[48rem\]/,
);

console.log("Shared patient dialogue tone validation passed.");
