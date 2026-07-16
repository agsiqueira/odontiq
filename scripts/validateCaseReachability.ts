import { CASE_DATA } from "../src/data/cases";
import { CANONICAL_CASE_SPECS } from "../src/data/canonicalCaseSpecs";
import { classifyQuestion, extractPatientFacts, selectAllowedFacts, topicFromPatientFact } from "../src/lib/patientDisclosure";
import { SEMANTIC_QUESTION_FIXTURES } from "../validation/canonicalCases/questions";

const strict = process.argv.includes("--strict");
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
let failures = 0;

for (const spec of CANONICAL_CASE_SPECS) {
  const current = CASE_DATA.find((item) => item.metadata.id === spec.identity.caseId)!;
  const stored = normalize(JSON.stringify(current));
  const extracted = extractPatientFacts(current);
  const issues: string[] = [];

  for (const fact of spec.facts.filter((item) =>
    item.rubricRequired &&
    item.questions?.length &&
    !["examination-only", "diagnostic-viewer-only", "clinician-inference-only"].includes(item.disclosureRequirement)
  )) {
    const matchers = fact.implementationMatchers ?? [];
    const idMatches = extracted.filter((item) => item.id === fact.id || item.canonicalFactIds?.includes(fact.id));

    if (!idMatches.length && (!matchers.length || !matchers.every((matcher) => stored.includes(normalize(matcher))))) {
      issues.push(`${fact.id}: fact not stored`);
      continue;
    }

    const matches = idMatches.length
      ? idMatches
      : extracted.filter((item) => matchers.some((matcher) => normalize(item.text).includes(normalize(matcher))));

    if (!matches.length) {
      issues.push(`${fact.id}: fact stored but not extracted`);
      continue;
    }
    if (!idMatches.length && matches.some((item) => topicFromPatientFact(item.text) !== item.topic)) {
      issues.push(`${fact.id}: fact extracted but incorrectly classified`);
      continue;
    }

    const results = fact.questions!.map((question) => {
      const classification = classifyQuestion(question);
      return {
        classification,
        allowed: selectAllowedFacts({ caseId: current.metadata.id, facts: extracted, classification, disclosedFactIds: new Set(), question }),
      };
    });
    const reachesFact = (result: (typeof results)[number]) =>
      result.allowed.some((allowed) => matches.some((match) => match.id === allowed.id));

    if (!results.some(reachesFact)) {
      issues.push(`${fact.id}: classified but unreachable by an appropriate question`);
    } else if (results.filter(reachesFact).every((result) => result.classification.isBroadQuestion)) {
      issues.push(`${fact.id}: reachable only through an overly broad question`);
    }

    const broadQuestion = "Tell me more about what brings you in?";
    const broadClassification = classifyQuestion(broadQuestion);
    const earlyFacts = selectAllowedFacts({ caseId: current.metadata.id, facts: extracted, classification: broadClassification, disclosedFactIds: new Set(), question: broadQuestion });
    if (fact.disclosureRequirement.startsWith("targeted") && earlyFacts.some((allowed) => matches.some((match) => match.id === allowed.id))) {
      issues.push(`${fact.id}: fact revealed before the intended prerequisite`);
    }
  }

  failures += issues.length;
  console.log(`\n${spec.identity.caseId} (${issues.length} unreachable rubric-required fact families)`);
  issues.forEach((issue) => console.log(`ERROR ${issue}`));
}

const questions = Object.values(SEMANTIC_QUESTION_FIXTURES).flat();
for (const question of questions) {
  if (classifyQuestion(question).providerMessageIntent !== "question") {
    console.log(`ERROR semantic question not classified as question: ${question}`);
    failures += 1;
  }
}
console.log(`\nReachability validation: ${failures} issue(s); ${questions.length} deterministic questions; mode=${strict ? "strict" : "report"}.`);
if (strict && failures) process.exitCode = 1;
