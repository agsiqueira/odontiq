import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getCaseUrgencyDisplayLabel,
  getLearnerInterfaceText,
} from "../src/lib/interfaceTerminology";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";

assert.equal(getCaseUrgencyDisplayLabel("Emergency"), "Hospital Assessment");
assert.equal(getCaseUrgencyDisplayLabel("Urgent"), "Urgent");
assert.equal(
  getLearnerInterfaceText("Recognized Emergency-Level Urgency"),
  "Recognized Need for Hospital Assessment",
);
assert.equal(
  getLearnerInterfaceText(
    "Recognized the case as an emergency-level deep space infection risk.",
  ),
  "Recognized the deep-space infection risk and need for immediate hospital assessment.",
);
assert.equal(
  getLearnerInterfaceText("Recognized the case as emergency-level urgency."),
  "Recognized the systemic infection as requiring immediate hospital assessment.",
);

const patientCardSource = await readFile(
  new URL("../src/components/PatientProfileCard.tsx", import.meta.url),
  "utf8",
);
const facultyReportSource = await readFile(
  new URL("../src/components/FacultyCaseReport.tsx", import.meta.url),
  "utf8",
);
const comparisonSource = await readFile(
  new URL("../src/lib/facultyRubric/report/comparison.ts", import.meta.url),
  "utf8",
);
const terminologySource = await readFile(
  new URL("../src/lib/interfaceTerminology.ts", import.meta.url),
  "utf8",
);

assert.match(patientCardSource, /getCaseUrgencyDisplayLabel\(presentation\.urgency\)/);
assert.doesNotMatch(comparisonSource, /"Emergency assessment"/i);
assert.doesNotMatch(
  [patientCardSource, facultyReportSource, comparisonSource].join("\n"),
  />[^<{]*\bemergency\b[^<{]*</i,
);
assert.doesNotMatch(
  terminologySource,
  /["'`]Immediate["'`]/,
  "Immediate must not be introduced as a standalone interface label.",
);

for (const caseId of ["case-01", "case-02"]) {
  const rubric = facultyRubrics.find((candidate) => candidate.caseId === caseId);
  assert(rubric, `${caseId} rubric is required.`);
  const urgencyCriterion = rubric.criteria.find(
    (criterion) => criterion.name === "recognized-emergency-urgency",
  );
  assert(urgencyCriterion, `${caseId} emergency-urgency criterion is required.`);
  assert.equal(urgencyCriterion.expectedValue, "emergency");
  assert.equal(urgencyCriterion.critical, true);
}

console.log("Production interface terminology validation passed.");
