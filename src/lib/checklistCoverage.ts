import type { EvaluatorDomain } from "@/data/cases";

type ChecklistCoverageCase = {
  assets?: {
    examinations?: Array<{
      id: string;
      title?: string;
      label?: string;
      description?: string;
    }>;
  };
  patientChecklist: Array<{
    id: string;
    label: string;
    domain: EvaluatorDomain;
    triggers?: string[];
  }>;
  clinicalChecklist?: Array<{
    id: string;
    label: string;
    domain: EvaluatorDomain;
  }>;
};

type ChecklistCoverageEncounterEvent = {
  type: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
};

export type ChecklistCoverageEvidence = {
  checklistItemId: string;
  source: "student_message" | "examination_event";
  evidence: string;
  timestamp?: string;
};

export type ChecklistCoverageResult = {
  newlyCoveredChecklistIds: string[];
  evidence: ChecklistCoverageEvidence[];
};

type CoverageMatcher = {
  id: string;
  patterns: RegExp[];
};

const restrictedClinicalQuestionPattern =
  /\b(diagnos|diagnosis|differential|impression|treatment plan|management plan|care plan|what'?s the plan|what is the plan|what should (i|we) do|should i prescribe|prescribe|refer|referral|procedure)\b/i;

const patientQuestionOverridePattern =
  /\b(are you|do you|did you|have you|can you|could you|when did|when was|when has|how long|how bad|how much|where|which tooth|what tooth|what brings|why are you here|what is bothering you|what medications? (are you|do you)|what medicine|any allergies|allergic)\b/i;

const supplementalMatchers: CoverageMatcher[] = [
  {
    id: "greeting",
    patterns: [
      /\b(hello|hi|good morning|good afternoon|good evening)\b/i,
      /\b(my name is|i'?m|i am)\s+(dr\.?|doctor)\b/i,
      /\b(nice to meet you|confirm your name|verify your name)\b/i,
    ],
  },
  {
    id: "chief-complaint",
    patterns: [
      /\b(what brings you in|what brought you in|why are you here|how can i help|main concern|main problem|chief complaint|what is bothering you|what seems to be the problem)\b/i,
    ],
  },
  {
    id: "onset",
    patterns: [
      /\bwhen\s+(did|was|has|have).*\b(start|begin|began|notice|noticed|first)\b/i,
      /\b(onset|first notice|started|began)\b/i,
    ],
  },
  {
    id: "duration",
    patterns: [
      /\b(how long|for how long|how many days|how many weeks|duration|since when)\b/i,
    ],
  },
  {
    id: "pain-character",
    patterns: [
      /\b(how bad|severity|scale|rate|0 to 10|1 to 10|describe.*pain|sharp|dull|throbbing|constant|pulsing)\b/i,
    ],
  },
  {
    id: "location",
    patterns: [
      /\b(where|which tooth|what tooth|what area|what side|upper|lower|left|right)\b/i,
    ],
  },
  {
    id: "swelling",
    patterns: [
      /\b(swelling|swollen|spread|spreading|face|facial|cheek|jaw swelling|puffy)\b/i,
    ],
  },
  {
    id: "airway",
    patterns: [
      /\b(airway|breath|breathing|short of breath|swallow|swallowing|trouble swallowing|trouble breathing|lie flat|lying flat|lay flat)\b/i,
    ],
  },
  {
    id: "systemic-symptoms",
    patterns: [
      /\b(fever|chills|temperature|feel sick|feeling sick|malaise|systemic)\b/i,
    ],
  },
  {
    id: "medications",
    patterns: [
      /\b(what medications?|what medicines?|what meds?|are you taking|do you take|take anything|taken anything|ibuprofen|acetaminophen|tylenol|advil|painkiller|antibiotic)\b/i,
    ],
  },
  {
    id: "allergies",
    patterns: [
      /\b(allerg|allergy|allergies|allergic|penicillin)\b/i,
    ],
  },
  {
    id: "trismus",
    patterns: [
      /\b(open your mouth|mouth opening|open wide|trismus|jaw opening|can you open)\b/i,
    ],
  },
  {
    id: "thermal-sensitivity",
    patterns: [
      /\b(hot|cold|temperature|sensitive|sensitivity|thermal)\b/i,
    ],
  },
  {
    id: "biting-pain",
    patterns: [
      /\b(bite|biting|chew|chewing|tap|tapping|pressure|when you bite)\b/i,
    ],
  },
  {
    id: "drainage",
    patterns: [
      /\b(drainage|pus|bad taste|discharge|taste|draining)\b/i,
    ],
  },
  {
    id: "medical-history",
    patterns: [
      /\b(medical history|health history|health conditions|medical conditions|diabetes|pregnant|pregnancy|surgeries|hospitalizations)\b/i,
    ],
  },
  {
    id: "social-history",
    patterns: [
      /\b(social history|smoke|smoking|tobacco|alcohol|drugs|work|job|living)\b/i,
    ],
  },
  {
    id: "dental-history",
    patterns: [
      /\b(dental history|dental work|dentist|filling|crown|cavity|root canal|extraction|previous treatment)\b/i,
    ],
  },
  {
    id: "bruxism",
    patterns: [/\b(grind|grinding|clench|clenching|bruxism)\b/i],
  },
  {
    id: "periodontal-bleeding",
    patterns: [/\b(bleed|bleeding|gums bleed|brushing)\b/i],
  },
  {
    id: "mobility",
    patterns: [/\b(loose|mobility|moving|wiggle|wobbly)\b/i],
  },
  {
    id: "food-trapping",
    patterns: [/\b(food.*(trap|stuck)|trapped food|between teeth)\b/i],
  },
  {
    id: "radiation",
    patterns: [/\b(radiate|radiates|spread|travels|ear)\b/i],
  },
  {
    id: "patient-goals",
    patterns: [
      /\b(goal|goals|what are you hoping|save the tooth|lose the tooth|worried about losing)\b/i,
    ],
  },
];

export function detectStudentMessageChecklistCoverage({
  caseData,
  latestStudentMessage,
  existingCoveredChecklistIds,
  timestamp,
}: {
  caseData: ChecklistCoverageCase;
  latestStudentMessage: string;
  existingCoveredChecklistIds: string[];
  timestamp?: string;
}): ChecklistCoverageResult {
  const normalizedMessage = normalizeMessage(latestStudentMessage);

  if (
    !normalizedMessage ||
    isRestrictedClinicalQuestion(normalizedMessage)
  ) {
    return { newlyCoveredChecklistIds: [], evidence: [] };
  }

  const alreadyCovered = new Set(existingCoveredChecklistIds);
  const newlyCoveredChecklistIds = caseData.patientChecklist
    .filter((item) => !alreadyCovered.has(item.id))
    .filter((item) => item.id !== "examination-findings")
    .filter((item) => matchesChecklistItem(item, normalizedMessage))
    .map((item) => item.id);

  return {
    newlyCoveredChecklistIds,
    evidence: newlyCoveredChecklistIds.map((checklistItemId) => ({
      checklistItemId,
      source: "student_message",
      evidence: latestStudentMessage.trim(),
      timestamp,
    })),
  };
}

export function detectClinicalChecklistCoverage({
  caseData,
  encounterEvents,
  examinationsViewed,
  existingCoveredChecklistIds,
}: {
  caseData: ChecklistCoverageCase;
  encounterEvents: ChecklistCoverageEncounterEvent[];
  examinationsViewed: string[];
  existingCoveredChecklistIds: string[];
}): ChecklistCoverageResult {
  const viewedExaminationIds = collectViewedExaminationIds({
    encounterEvents,
    examinationsViewed,
  });

  if (viewedExaminationIds.length === 0) {
    return { newlyCoveredChecklistIds: [], evidence: [] };
  }

  const alreadyCovered = new Set(existingCoveredChecklistIds);
  const eventEvidence = buildExaminationEvidence({
    caseData,
    encounterEvents,
    viewedExaminationIds,
  });
  const examinationSupportedItems = [
    ...caseData.patientChecklist.filter(isPatientExaminationChecklistItem),
    ...(caseData.clinicalChecklist ?? []).filter(
      isClinicalExaminationChecklistItem,
    ),
  ];
  const newlyCoveredChecklistIds = examinationSupportedItems
    .filter((item) => !alreadyCovered.has(item.id))
    .map((item) => item.id);

  return {
    newlyCoveredChecklistIds,
    evidence: newlyCoveredChecklistIds.map((checklistItemId) => ({
      checklistItemId,
      source: "examination_event",
      evidence: eventEvidence.evidence,
      timestamp: eventEvidence.timestamp,
    })),
  };
}

function isRestrictedClinicalQuestion(message: string) {
  return (
    restrictedClinicalQuestionPattern.test(message) &&
    !patientQuestionOverridePattern.test(message)
  );
}

function collectViewedExaminationIds({
  encounterEvents,
  examinationsViewed,
}: {
  encounterEvents: ChecklistCoverageEncounterEvent[];
  examinationsViewed: string[];
}) {
  return [
    ...examinationsViewed,
    ...encounterEvents
      .filter((event) => event.type === "examination_viewed")
      .map(getEventExaminationId),
  ].filter((id, index, ids): id is string => Boolean(id) && ids.indexOf(id) === index);
}

function buildExaminationEvidence({
  caseData,
  encounterEvents,
  viewedExaminationIds,
}: {
  caseData: ChecklistCoverageCase;
  encounterEvents: ChecklistCoverageEncounterEvent[];
  viewedExaminationIds: string[];
}) {
  const latestViewEvent = [...encounterEvents]
    .reverse()
    .find(
      (event) =>
        event.type === "examination_viewed" &&
        viewedExaminationIds.includes(getEventExaminationId(event) ?? ""),
    );
  const latestExaminationId =
    getEventExaminationId(latestViewEvent) ?? viewedExaminationIds.at(-1) ?? "";
  const examinationLabel = labelForExamination(caseData, latestExaminationId);

  return {
    evidence: `Viewed ${examinationLabel}`,
    timestamp: latestViewEvent?.timestamp,
  };
}

function getEventExaminationId(
  event: ChecklistCoverageEncounterEvent | undefined,
) {
  const examinationId = event?.payload?.examinationId;

  return typeof examinationId === "string" && examinationId.trim()
    ? examinationId.trim()
    : undefined;
}

function labelForExamination(
  caseData: ChecklistCoverageCase,
  examinationId: string,
) {
  const examination = caseData.assets?.examinations?.find(
    (asset) => asset.id === examinationId,
  );

  return (
    examination?.label ??
    examination?.title ??
    examination?.description ??
    examinationId
  );
}

function isPatientExaminationChecklistItem(
  item: ChecklistCoverageCase["patientChecklist"][number],
) {
  return item.id === "examination-findings";
}

function isClinicalExaminationChecklistItem(
  item: NonNullable<ChecklistCoverageCase["clinicalChecklist"]>[number],
) {
  return (
    item.domain === "examination" ||
    /\b(exam|examination|findings|radiograph|x-?ray|image|clinical findings|visual)\b/i.test(
      item.label,
    )
  );
}

function matchesChecklistItem(
  item: ChecklistCoverageCase["patientChecklist"][number],
  message: string,
) {
  if (item.id === "medications" && isMedicationAllergyOnlyQuestion(message)) {
    return false;
  }

  const supplementalMatcher = supplementalMatchers.find(
    (matcher) => matcher.id === item.id,
  );

  if (supplementalMatcher?.patterns.some((pattern) => pattern.test(message))) {
    return true;
  }

  return (item.triggers ?? []).some((trigger) =>
    triggerMatchesMessage(trigger, message),
  );
}

function isMedicationAllergyOnlyQuestion(message: string) {
  return (
    /\ballerg/.test(message) &&
    !/\b(are you taking|do you take|what medications|what medicines|what meds|take anything|taken anything|pain relief|painkiller|ibuprofen|acetaminophen|tylenol|advil|antibiotic)\b/i.test(
      message,
    )
  );
}

function triggerMatchesMessage(trigger: string, message: string) {
  const normalizedTrigger = normalizeMessage(trigger);

  if (!normalizedTrigger || normalizedTrigger.length < 3) {
    return false;
  }

  const escapedTrigger = escapeRegExp(normalizedTrigger).replace(/\s+/g, "\\s+");
  const startsWithWord = /^[a-z0-9]/i.test(normalizedTrigger);
  const endsWithWord = /[a-z0-9]$/i.test(normalizedTrigger);
  const pattern = `${startsWithWord ? "\\b" : ""}${escapedTrigger}${
    endsWithWord ? "\\b" : ""
  }`;

  return new RegExp(pattern, "i").test(message);
}

function normalizeMessage(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
