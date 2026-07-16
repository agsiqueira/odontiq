import assert from "node:assert/strict";

import { CASE_DATA } from "../src/data/cases";
import { CANONICAL_CASE_SPECS } from "../src/data/canonicalCaseSpecs";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { extractPatientFacts } from "../src/lib/patientDisclosure";

const normalize = (value: unknown) => JSON.stringify(value).toLowerCase();
const byId = new Map(CASE_DATA.map((item) => [item.metadata.id, item]));

for (const spec of CANONICAL_CASE_SPECS) {
  const runtime = byId.get(spec.identity.caseId);
  assert(runtime, `${spec.identity.caseId}: runtime case is missing`);
  assert.equal(runtime.patient.age, spec.identity.age, `${spec.identity.caseId}: age diverges from canonical fixture`);
  assert(runtime.assets.examinations.some((item) => item.type === "clinical-findings"), `${spec.identity.caseId}: structured clinical examination is missing`);
  assert(runtime.assets.examinations.every((item) => item.id.trim() && item.title.trim()), `${spec.identity.caseId}: examination IDs and labels must be non-empty`);

  const patientCorpus = normalize(extractPatientFacts(runtime));
  const examinationCorpus = normalize(runtime.assets.examinations);
  assert(!patientCorpus.includes("wbc 14.8"), `${spec.identity.caseId}: diagnostic laboratory data leaked into patient facts`);
  assert(!patientCorpus.includes("ct-confirmed"), `${spec.identity.caseId}: CT interpretation leaked into patient facts`);
  if (spec.identity.caseId === "case-02") {
    assert(examinationCorpus.includes("laboratory results") && examinationCorpus.includes("14.8"), "case-02: laboratory results are missing from clinician-facing diagnostics");
    assert(examinationCorpus.includes("ct face with iv contrast"), "case-02: CT results are missing from clinician-facing diagnostics");
  }
}

const forbiddenPositiveRuntime: Record<string, RegExp[]> = {
  "case-01": [/upper-right odontogenic abscess/i, /stomach ulcers/i, /cracked tooth as the primary/i, /irreversible pulpitis/i],
  "case-02": [/ludwig'?s angina/i, /type 2 diabetes/i, /penicillin allergy causing hives/i, /spontaneous nocturnal pain/i],
  "case-03": [/type 2 diabetes(?!.*does not have)/i, /periodontal abscess as the expected/i, /left mandibular/i, /maxillary infiltration is appropriate/i, /recommend ibuprofen/i],
  "case-04": [/bit(?:ing)? a hard object caused/i, /diagnosis":"cracked tooth/i, /current cold sensitivity/i, /(?<!no )current abscess/i, /routine antibiotics are indicated/i],
  "case-05": [/cold (?:relieves|calms)/i, /hot drinks worsen/i, /radiates? (?:toward|to) (?:the )?ear/i, /not pregnant/i, /two weeks/i, /"age":27/i, /(?<!no )current abscess/i],
};
for (const [caseId, patterns] of Object.entries(forbiddenPositiveRuntime)) {
  const corpus = normalize(byId.get(caseId));
  for (const pattern of patterns) assert(!pattern.test(corpus), `${caseId}: cross-case or unsupported fact matched ${pattern}`);
}

const criterionIds = facultyRubrics.flatMap((rubric) => rubric.criteria.map((criterion) => criterion.id));
assert.equal(new Set(criterionIds).size, criterionIds.length, "Faculty criterion IDs must be globally unique");
for (const rubric of facultyRubrics) {
  for (const criterion of rubric.criteria) {
    assert(Number.isFinite(criterion.weight) && criterion.weight >= 0, `${criterion.id}: invalid weight`);
    if (criterion.expectation === "required") assert(criterion.weight > 0, `${criterion.id}: required criterion must have positive weight`);
  }
  const recognition = rubric.criteria.filter((criterion) => criterion.id.includes("-EX-") && !criterion.name.includes("reviewed-available"));
  assert(recognition.every((criterion) => criterion.evaluationMode === "clinical-statement"), `${rubric.caseId}: examination recognition must require learner-authored evidence`);
}

const rubricCorpus = (caseId: string) => normalize(facultyRubrics.find((item) => item.caseId === caseId));
assert(!/pregnan|hot sensitivity|radiat/.test(rubricCorpus("case-05")), "case-05: unsupported heat, radiation, or pregnancy entered the rubric");
assert(!/routine antibiotics are indicated|recommended routine antibiotics/.test(rubricCorpus("case-04")), "case-04: rubric rewards routine antibiotics");
assert(!/recommended ibuprofen|ibuprofen recommended/.test(rubricCorpus("case-03")), "case-03: rubric rewards ibuprofen");

console.log("Case remediation release-readiness invariants passed for Cases 1-5.");
