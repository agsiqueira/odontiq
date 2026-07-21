import assert from "node:assert/strict";

import {
  normalizePatientDialogue,
  normalizePatientDialogueWithDiagnostics,
  normalizeOuterPatientQuoteWrapper,
} from "../src/lib/patientDialogue";

const cases = [
  {
    name: "Markdown heading",
    input: "### I have had pain since yesterday.",
    expected: "I have had pain since yesterday.",
  },
  {
    name: "Numbered list",
    input:
      "1. My tooth hurts.\n2. My face feels swollen.\n3. I had a fever last night.",
    expected:
      "My tooth hurts. My face feels swollen. I had a fever last night.",
  },
  {
    name: "Bulleted list",
    input: "- The pain is sharp.\n- It gets worse when I chew.",
    expected: "The pain is sharp. It gets worse when I chew.",
  },
  {
    name: "Preserve clinical numbers",
    input:
      "The pain is 8 out of 10 and started 3 days ago. I took 500 mg of acetaminophen.",
    expected:
      "The pain is 8 out of 10 and started 3 days ago. I took 500 mg of acetaminophen.",
  },
  {
    name: "Preserve decimal numbers",
    input: "I took 2.5 mg this morning.",
    expected: "I took 2.5 mg this morning.",
  },
  {
    name: "Remove response label",
    input: "Patient: My lower left tooth has been hurting.",
    expected: "My lower left tooth has been hurting.",
  },
  {
    name: "Remove structural heading and mixed formatting",
    input:
      "### Symptoms\n\n1. My **jaw** hurts.\n2. I have `swelling`.\n3. It started yesterday.",
    expected: "My jaw hurts. I have swelling. It started yesterday.",
  },
  {
    name: "Preserve separate paragraphs",
    input: "My tooth hurts.\n\nIt started yesterday.",
    expected: "My tooth hurts.\n\nIt started yesterday.",
  },
] as const;

for (const testCase of cases) {
  assert.equal(
    normalizePatientDialogue(testCase.input),
    testCase.expected,
    testCase.name,
  );
}

const diagnosticResult = normalizePatientDialogueWithDiagnostics(
  "Response:\n- My **tooth** hurts.",
);
assert.equal(diagnosticResult.changed, true);
assert.deepEqual(
  new Set(diagnosticResult.categories),
  new Set(["label", "bullet-list", "emphasis"]),
);

console.log(
  `Patient dialogue normalization validation passed (${cases.length} cases).`,
);

const quoteCases: Array<[string, string]> = [
  ['"My tooth hurts."', "My tooth hurts."],
  ["'My tooth hurts.'", "My tooth hurts."],
  ["“My tooth hurts.”", "My tooth hurts."],
  ["‘My tooth hurts.’", "My tooth hurts."],
  ['   "My tooth hurts."   ', "My tooth hurts."],
  ['My wife said, "Go to the dentist."', 'My wife said, "Go to the dentist."'],
  ['He called it the "worst pain ever."', 'He called it the "worst pain ever."'],
  ["I said 'yes' when they asked.", "I said 'yes' when they asked."],
  ['"My tooth hurts.', '"My tooth hurts.'],
  ['My tooth hurts."', 'My tooth hurts."'],
  ['""', ""],
  ['"\'My tooth hurts.\'"', "'My tooth hurts.'"],
];
for (const [input, expected] of quoteCases) {
  assert.equal(normalizeOuterPatientQuoteWrapper(input), expected, input);
}

const quotedDiagnostic = normalizePatientDialogueWithDiagnostics(' "My tooth hurts." ');
assert.equal(quotedDiagnostic.text, "My tooth hurts.");
assert(quotedDiagnostic.categories.includes("outer-quotes"));
console.log(`Patient outer-quote normalization passed (${quoteCases.length} cases).`);
