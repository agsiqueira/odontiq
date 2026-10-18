import case01 from "../../data/cases/case-01/case.json";
import { AMARA_BEHAVIORAL_CONTRACT, AMARA_PATIENT_ID } from "./amaraContract";
import { renderPatientBehavior } from "./renderer";
import type { GovernedFact } from "./types";

type FixtureDefinition = {
  id: string;
  label: string;
  originalText: string;
  factId?: string;
  exactValues?: readonly string[];
  requiredTerms?: readonly string[];
  polarity?: GovernedFact["polarity"];
  exactTextRequired?: boolean;
};

const definitions: readonly FixtureDefinition[] = [
  { id: "duration", label: "Pain duration", originalText: "The dental pain has been worsening for four days.", factId: "c1.duration", exactValues: ["four days"] },
  { id: "score", label: "Pain score", originalText: "The pain is eight out of ten now.", factId: "c1.severity", exactValues: ["eight out of ten"] },
  { id: "location", label: "Pain location", originalText: "The painful tooth is my lower-left molar.", factId: "c1.location", requiredTerms: ["lower-left", "molar"] },
  { id: "onset", label: "Onset / triggering course", originalText: "It started gradually as a dull toothache, then got worse quickly.", factId: "c1.pain", requiredTerms: ["gradually", "dull toothache", "worse quickly"] },
  { id: "swelling", label: "Swelling", originalText: "The swelling is on both sides under my jaw.", factId: "c1.swelling-location", requiredTerms: ["swelling", "both sides", "under my jaw"], polarity: "positive" },
  { id: "fever", label: "Systemic symptom", originalText: "Yes. I have felt very hot, but I did not have a thermometer at home.", factId: "c1.fever", requiredTerms: ["very hot", "thermometer"], polarity: "positive" },
  { id: "swallowing", label: "Airway symptom", originalText: "Yes. It is very hard to swallow.", factId: "c1.dysphagia", requiredTerms: ["hard to swallow"], polarity: "positive" },
  { id: "medications", label: "Medication usage", originalText: "I take metformin and lisinopril.", factId: "c1.metformin", requiredTerms: ["metformin", "lisinopril"] },
  { id: "allergies", label: "Allergy status", originalText: "I have no known drug allergies, including no penicillin allergy.", factId: "c1.nkda", requiredTerms: ["drug allergies", "penicillin"], polarity: "negative" },
  { id: "negative", label: "Negative symptom", originalText: "No, I do not have chest pain.", factId: "c1.chest-pain", requiredTerms: ["chest pain"], polarity: "negative" },
  { id: "multi", label: "Long multi-fact response", originalText: "I have a bad toothache and swelling, and swallowing is hard. I feel short of breath if I lie down.", factId: "c1.dyspnea-supine", requiredTerms: ["toothache", "swelling", "swallowing", "short of breath", "lie down"], polarity: "positive" },
  { id: "conversation", label: "Low-risk conversation", originalText: "I am trying to answer, but I do not feel well." },
  { id: "exact", label: "Exact unsupported reply", originalText: "I haven't noticed that.", exactTextRequired: true },
];

export function buildAmaraBehaviorFixtures() {
  return definitions.map((definition) => {
    const governedFacts = definition.factId
      ? [fixtureFact(definition)]
      : [];
    const result = renderPatientBehavior({
      patientId: AMARA_PATIENT_ID,
      caseId: "case-01",
      originalText: definition.originalText,
      governedFacts,
      contract: AMARA_BEHAVIORAL_CONTRACT,
      exactTextRequired: definition.exactTextRequired,
    });
    return { ...definition, governedFacts, result };
  });
}

export function buildAmaraRepetitionFixtures() {
  const definition = definitions.find((item) => item.id === "duration");
  if (!definition) throw new Error("Missing duration fixture");
  const governedFacts = [fixtureFact(definition)];
  return ([
    { label: "First duration ask", level: "none", askCount: 1 },
    { label: "First semantic repeat", level: "first_repeat", askCount: 2 },
    { label: "Later semantic repeat", level: "later_repeat", askCount: 3 },
  ] as const).map((scenario) => ({
    id: `duration-${scenario.level}`,
    label: scenario.label,
    originalText: definition.originalText,
    governedFacts,
    result: renderPatientBehavior({
      patientId: AMARA_PATIENT_ID,
      caseId: "case-01",
      originalText: definition.originalText,
      governedFacts,
      contract: AMARA_BEHAVIORAL_CONTRACT,
      repetition: {
        level: scenario.level,
        clarificationSafe: false,
        countsTowardHistory: true,
        reason: scenario.level === "none" ? "first-ask" : "semantic-repeat",
        history: {
          intentId: "duration",
          askCount: scenario.askCount,
          clearAnswerCount: scenario.askCount - 1,
          lastGovernedFactIds: ["c1.duration"],
        },
      },
    }),
  }));
}

function fixtureFact(definition: FixtureDefinition): GovernedFact {
  const canonical = case01.supportingInfo.patientFacts.find(
    (fact) => fact.id === definition.factId,
  );
  if (!canonical) throw new Error(`Missing Case 1 fact ${definition.factId}`);
  return {
    id: canonical.id,
    canonicalValue: canonical.text,
    source: "case-definition",
    exactValues: definition.exactValues,
    requiredTerms: definition.requiredTerms,
    polarity: definition.polarity,
    certain: true,
    rubricRelevant: true,
  };
}
