import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PATIENT_QUESTION_CATALOG } from "../src/lib/patientQuestions/catalog";

const readSource = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const [experience, conversation, shell, composer, appShell] = await Promise.all([
  readSource("src/components/EncounterExperience.tsx"),
  readSource("src/components/InteractionConversation.tsx"),
  readSource("src/components/InteractionExperienceShell.tsx"),
  readSource("src/components/InteractionComposer.tsx"),
  readSource("src/components/AppShell.tsx"),
]);

assert.match(
  experience,
  /max-w-\[30rem\][^"\n]*md:max-w-\[48rem\]/,
  "The consultation must retain its phone width and use the approved tablet width at md.",
);
assert.match(
  experience,
  /h-\[clamp\(10rem,32dvh,15\.75rem\)\][^"\n]*md:h-\[clamp\(12rem,28dvh,18rem\)\]/,
  "Phone media sizing and tablet media sizing must both remain explicit.",
);
assert.match(
  experience,
  /max-w-\[28rem\][^"\n]*md:w-auto[^"\n]*md:max-w-\[32rem\]/,
);
assert.match(conversation, /md:max-w-\[38rem\]/);
assert.match(conversation, /isStudent && "ml-auto max-w-\[92%\]"/);
assert.match(conversation, /scrollIntoView\(\{/);
assert.match(conversation, /data-testid=\{`\$\{message\.role\}-message`\}/);

const characterIndex = experience.indexOf("character={");
const conversationIndex = experience.indexOf("conversation={");
const composerIndex = experience.indexOf("composer={");
const actionsIndex = experience.indexOf("bottomAction={");
assert(
  characterIndex < conversationIndex &&
    conversationIndex < composerIndex &&
    composerIndex < actionsIndex,
  "The existing one-column character, conversation, composer, and action order must remain unchanged.",
);

for (const requiredHandler of [
  "onSubmit={() =>",
  "onToggleVoiceInput={toggleVoiceInput}",
  "onClick={requestPauseConsultation}",
  "onClick={requestFinishConsultation}",
]) {
  assert(
    experience.includes(requiredHandler),
    `The existing consultation handler must remain present: ${requiredHandler}`,
  );
}
assert.match(composer, /min-h-11/);
assert.match(composer, /focus:ring-4/);
assert.doesNotMatch(shell, /(?:md|lg|xl):grid-cols-/);

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

assert.match(appShell, /max-w-\[30rem\][^"\n]*md:max-w-\[48rem\]/);

console.log("Tablet-first consultation presentation validation passed.");
