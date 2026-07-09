import { loadCase } from "@/data/cases";

type EvaluateEncounterInput = {
  caseId: string;
  coveredChecklistItems: string[];
};

type ChecklistSectionEvaluation = {
  total: number;
  completed: number;
  missed: string[];
  score: number;
};

export type ChecklistEvaluation = {
  patient: ChecklistSectionEvaluation;
  clinical: ChecklistSectionEvaluation;
  overall: number;
};

const emptyEvaluation: ChecklistEvaluation = {
  patient: {
    total: 0,
    completed: 0,
    missed: [],
    score: 0,
  },
  clinical: {
    total: 0,
    completed: 0,
    missed: [],
    score: 0,
  },
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

  return {
    patient,
    clinical,
    overall: Math.round((patient.score * 0.5 + clinical.score * 0.5) * 100) / 100,
  };
}

function evaluateChecklistSection(
  checklistItems: Array<{ id: string; label: string }>,
  coveredIds: Set<string>,
): ChecklistSectionEvaluation {
  const total = checklistItems.length;
  const completed = checklistItems.filter((item) => coveredIds.has(item.id))
    .length;
  const missed = checklistItems
    .filter((item) => !coveredIds.has(item.id))
    .map((item) => item.label);

  return {
    total,
    completed,
    missed,
    score: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
  };
}
