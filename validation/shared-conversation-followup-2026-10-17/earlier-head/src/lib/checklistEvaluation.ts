import { loadCase, type EvaluatorDomain } from "../data/cases";

type EvaluateEncounterInput = {
  caseId: string;
  coveredChecklistItems: string[];
};

type ChecklistSectionEvaluation = {
  total: number;
  completed: number;
  earnedWeight: number;
  availableWeight: number;
  missed: string[];
  criticalMisses: string[];
  score: number;
};

export type ChecklistEvaluation = {
  patient: ChecklistSectionEvaluation;
  clinical: ChecklistSectionEvaluation;
  domains: Record<EvaluatorDomain, ChecklistSectionEvaluation>;
  overall: number;
};

type EvaluatedChecklistItem = {
  id: string;
  label: string;
  domain: EvaluatorDomain;
  weight?: number;
  critical?: boolean;
};

const evaluatorDomains: EvaluatorDomain[] = [
  "communication",
  "history",
  "examination",
  "reasoning",
  "management",
];

const emptyEvaluation: ChecklistEvaluation = {
  patient: {
    total: 0,
    completed: 0,
    earnedWeight: 0,
    availableWeight: 0,
    missed: [],
    criticalMisses: [],
    score: 0,
  },
  clinical: {
    total: 0,
    completed: 0,
    earnedWeight: 0,
    availableWeight: 0,
    missed: [],
    criticalMisses: [],
    score: 0,
  },
  domains: createEmptyDomainEvaluation(),
  overall: 0,
};

export function evaluateEncounter({
  caseId,
  coveredChecklistItems,
}: EvaluateEncounterInput): ChecklistEvaluation {
  const caseData = loadCase(caseId);

  if (!caseData) {
    return emptyEvaluation;
  }

  const coveredIds = new Set(coveredChecklistItems);
  const patient = evaluateChecklistSection(
    caseData.patientChecklist,
    coveredIds,
  );
  const clinical = evaluateChecklistSection(
    caseData.clinicalChecklist,
    coveredIds,
  );
  const domains = evaluateDomains(
    [...caseData.patientChecklist, ...caseData.clinicalChecklist],
    coveredIds,
  );
  const sectionWeights = normalizeSectionWeights(
    caseData.supportingInfo.evaluation,
  );

  return {
    patient,
    clinical,
    domains,
    overall:
      Math.round(
        (patient.score * sectionWeights.patientChecklistWeight +
          clinical.score * sectionWeights.clinicalChecklistWeight) *
          100,
      ) / 100,
  };
}

function evaluateChecklistSection(
  checklistItems: EvaluatedChecklistItem[],
  coveredIds: Set<string>,
): ChecklistSectionEvaluation {
  const total = checklistItems.length;
  const completed = checklistItems.filter((item) => coveredIds.has(item.id))
    .length;
  const availableWeight = checklistItems.reduce(
    (sum, item) => sum + normalizeItemWeight(item.weight),
    0,
  );
  const earnedWeight = checklistItems
    .filter((item) => coveredIds.has(item.id))
    .reduce((sum, item) => sum + normalizeItemWeight(item.weight), 0);
  const missed = checklistItems
    .filter((item) => !coveredIds.has(item.id))
    .map((item) => item.label);
  const criticalMisses = checklistItems
    .filter((item) => item.critical && !coveredIds.has(item.id))
    .map((item) => item.label);

  return {
    total,
    completed,
    earnedWeight: roundScore(earnedWeight),
    availableWeight: roundScore(availableWeight),
    missed,
    criticalMisses,
    score:
      availableWeight > 0
        ? roundScore((earnedWeight / availableWeight) * 100)
        : 0,
  };
}

function evaluateDomains(
  checklistItems: EvaluatedChecklistItem[],
  coveredIds: Set<string>,
): Record<EvaluatorDomain, ChecklistSectionEvaluation> {
  const domains = createEmptyDomainEvaluation();

  for (const domain of evaluatorDomains) {
    domains[domain] = evaluateChecklistSection(
      checklistItems.filter((item) => item.domain === domain),
      coveredIds,
    );
  }

  return domains;
}

function createEmptyDomainEvaluation(): Record<
  EvaluatorDomain,
  ChecklistSectionEvaluation
> {
  return {
    communication: createEmptyChecklistSectionEvaluation(),
    history: createEmptyChecklistSectionEvaluation(),
    examination: createEmptyChecklistSectionEvaluation(),
    reasoning: createEmptyChecklistSectionEvaluation(),
    management: createEmptyChecklistSectionEvaluation(),
  };
}

function createEmptyChecklistSectionEvaluation(): ChecklistSectionEvaluation {
  return {
    total: 0,
    completed: 0,
    earnedWeight: 0,
    availableWeight: 0,
    missed: [],
    criticalMisses: [],
    score: 0,
  };
}

function normalizeItemWeight(weight: number | undefined) {
  return typeof weight === "number" && Number.isFinite(weight) && weight > 0
    ? weight
    : 1;
}

function normalizeSectionWeights(
  evaluation: {
    patientChecklistWeight?: number;
    clinicalChecklistWeight?: number;
  } | null,
) {
  const patientWeight =
    typeof evaluation?.patientChecklistWeight === "number" &&
    Number.isFinite(evaluation.patientChecklistWeight) &&
    evaluation.patientChecklistWeight >= 0
      ? evaluation.patientChecklistWeight
      : 0;
  const clinicalWeight =
    typeof evaluation?.clinicalChecklistWeight === "number" &&
    Number.isFinite(evaluation.clinicalChecklistWeight) &&
    evaluation.clinicalChecklistWeight >= 0
      ? evaluation.clinicalChecklistWeight
      : 0;
  const totalWeight = patientWeight + clinicalWeight;

  if (totalWeight <= 0) {
    return {
      patientChecklistWeight: 0.5,
      clinicalChecklistWeight: 0.5,
    };
  }

  return {
    patientChecklistWeight: patientWeight / totalWeight,
    clinicalChecklistWeight: clinicalWeight / totalWeight,
  };
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}
