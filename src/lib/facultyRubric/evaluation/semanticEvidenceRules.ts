import type { AiFacultyCriterionEvaluation } from "./semanticSchema";
import type { FacultyEvaluationMessage } from "./types";
import type { FacultyRubricCriterion } from "../types";

export type SemanticEvidenceRule = {
  criterionIds?: string[];
  criterionNames?: string[];
  requiredLearnerPatterns: RegExp[];
  forbiddenLearnerPatterns?: RegExp[];
};

export const semanticEvidenceRules: SemanticEvidenceRule[] = [
  {
    criterionIds: ["C1-IG-001", "C2-IG-001", "C3-IG-001", "C4-IG-001", "C5-IG-001", "C2-CF-002"],
    requiredLearnerPatterns: [
      /\b(fever(?:s|ish)?|febrile|(?:elevated|high) temperature|temperature|feel(?:ing)? (?:sick|unwell)|malaise|fatigue|weakness|body aches?|nausea|vomit(?:ing)?|systemic symptoms?)\b/i,
    ],
  },
  {
    criterionIds: ["C3-IG-005", "C4-IG-005", "C5-IG-005"],
    requiredLearnerPatterns: [
      /\b(?:bit(?:e|ing)(?: down)?|chew(?:ing)?|tap(?:ping)?|percussion)\b/i,
      /\b(?:pressure|press(?:ing|ed)?|touch(?:ing|ed)?|contact)\b.{0,35}\b(?:tooth|teeth)\b|\b(?:tooth|teeth)\b.{0,35}\b(?:pressure|press(?:ing|ed)?|touch(?:ing|ed)?|contact)\b/i,
      /\bteeth (?:come|coming) together\b/i,
    ],
  },
  {
    criterionIds: ["C3-IG-004", "C4-IG-004", "C5-IG-004"],
    requiredLearnerPatterns: [
      /\b(?:linger(?:s|ed|ing)?|persist(?:s|ed|ing)?|stop(?:s|ped|ping)? immediately|go(?:es)? away|after (?:the )?cold|cold (?:is|was) removed)\b/i,
    ],
  },
  {
    criterionNames: ["asked-about-duration", "asked-about-onset"],
    requiredLearnerPatterns: [
      /\b(how long|when did (?:it|this|the .+?) (?:start|begin)|when (?:did|was) .+ first|onset|started|began|first notice)\b/i,
    ],
  },
  {
    criterionNames: ["asked-about-pain-severity"],
    requiredLearnerPatterns: [
      /\b(how (?:bad|severe)|pain (?:score|scale|severity)|rate (?:the|your) pain|(?:zero|0|one|1) (?:to|through) (?:ten|10)|out of (?:ten|10))\b/i,
    ],
  },
  {
    criterionIds: ["C1-CF-001"],
    requiredLearnerPatterns: [
      /\b(trouble breathing|difficulty breathing|short(?:ness)? of breath|can you breathe|breathing (?:okay|normally|comfortably)|airway|dyspnea|lie flat|lying flat)\b/i,
    ],
  },
  {
    criterionIds: ["C1-CF-003"],
    requiredLearnerPatterns: [
      /\b(trouble swallowing|difficulty swallowing|pain(?:ful)? swallowing|does it hurt to swallow|can you swallow|dysphagia|odynophagia)\b/i,
    ],
  },
  {
    criterionNames: ["asked-about-trauma", "asked-about-precipitating-event"],
    requiredLearnerPatterns: [
      /\b(trauma|injur(?:y|ed)|hit|blow|fall|accident|what happened before|what brought (?:this|the pain) on|trigger(?:ed)?)\b/i,
    ],
  },
  {
    criterionIds: ["C1-IG-006", "C2-IG-006", "C3-IG-006", "C4-IG-006", "C5-IG-006"],
    requiredLearnerPatterns: [
      /\b(what medications?|what medicines?|what meds?|are you taking|do you take|taken anything|take anything|pain relief|ibuprofen|acetaminophen|tylenol|advil|motrin|antibiotics?)\b/i,
    ],
  },
  {
    criterionIds: ["C1-IG-002", "C3-IG-002", "C4-IG-002", "C5-IG-002"],
    requiredLearnerPatterns: [
      /\b(allerg(?:y|ies|ic)|reaction to (?:medicine|medication|penicillin)|penicillin reaction)\b/i,
    ],
  },
  {
    criterionIds: ["C3-MP-002"],
    requiredLearnerPatterns: [
      /\b(?:recommend|take|use|give|start|try|should|can)\b.{0,45}\b(?:acetaminophen|tylenol)\b|\b(?:acetaminophen|tylenol)\b.{0,45}\b(?:recommend|take|use|give|start|try|should|can)\b/i,
    ],
  },
  {
    criterionIds: ["C3-MP-007"],
    requiredLearnerPatterns: [
      /\b(?:recommend|take|use|give|start|try|should|can)\b.{0,45}\b(?:ibuprofen|advil|motrin|nsaid\w*|naproxen|aleve|ketorolac|toradol|diclofenac|celecoxib|celebrex)\b|\b(?:ibuprofen|advil|motrin|nsaid\w*|naproxen|aleve|ketorolac|toradol|diclofenac|celecoxib|celebrex)\b.{0,45}\b(?:recommend|take|use|give|start|try|should|can)\b/i,
    ],
    forbiddenLearnerPatterns: [
      /\b(?:do not|don't|avoid|should not|shouldn't|would not|wouldn't|not recommend|stop|instead of|rather than)\b.{0,55}\b(?:ibuprofen|advil|motrin|nsaid\w*|naproxen|aleve|ketorolac|toradol|diclofenac|celecoxib|celebrex)\b/i,
      /\brecommend(?:ed|ing)?\s+against\b.{0,45}\b(?:ibuprofen|advil|motrin|nsaid\w*|naproxen|aleve|ketorolac|toradol|diclofenac|celecoxib|celebrex)\b/i,
      /\b(?:acetaminophen|tylenol)\b.{0,35}\b(?:instead of|rather than)\b.{0,35}\b(?:ibuprofen|advil|motrin|nsaid\w*|naproxen|aleve|ketorolac|toradol|diclofenac|celecoxib|celebrex)\b/i,
      /\b(?:ibuprofen|advil|motrin|nsaid\w*|naproxen|aleve|ketorolac|toradol|diclofenac|celecoxib|celebrex)\b.{0,35}\b(?:upset|bother|intoler|ulcer|reaction|allerg)\w*\b/i,
    ],
  },
];

export function validateTargetedSemanticEvidence({
  criterionName,
  criterionId,
  result,
  messages,
}: {
  criterionName: string;
  criterionId?: string;
  result: Pick<AiFacultyCriterionEvaluation, "learnerEvidenceMessageIds"> &
    Partial<Pick<AiFacultyCriterionEvaluation, "contextualPatientMessageIds">>;
  messages: FacultyEvaluationMessage[];
}) {
  if (criterionId === "C2-IG-002") {
    return {
      applicable: true,
      valid: validatesEstablishedPenicillinAllergyStatus(result, messages),
    } as const;
  }

  const ruleById = criterionId
    ? semanticEvidenceRules.find((item) => item.criterionIds?.includes(criterionId))
    : undefined;
  const rule =
    ruleById ??
    semanticEvidenceRules.find((item) => item.criterionNames?.includes(criterionName));
  if (!rule) return { applicable: false, valid: true } as const;
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const valid = result.learnerEvidenceMessageIds.some((messageId) => {
    const message = messagesById.get(messageId);
    return (
      message?.role === "student" &&
      rule.requiredLearnerPatterns.some((pattern) => pattern.test(message.content)) &&
      !rule.forbiddenLearnerPatterns?.some((pattern) => pattern.test(message.content))
    );
  });
  return { applicable: true, valid } as const;
}

const penicillinClassPattern =
  /\b(?:penicillin(?:-class)?|amoxicillin|ampicillin|augmentin|amoxicillin[- ]clavulanate)\b/i;
const explicitPenicillinStatusPattern =
  /\b(?:penicillin(?:-class)?|amoxicillin|ampicillin|augmentin|amoxicillin[- ]clavulanate)\b.{0,55}\b(?:allerg|reaction|tolerat)|\b(?:allerg|reaction|tolerat)\w*\b.{0,55}\b(?:penicillin(?:-class)?|amoxicillin|ampicillin|augmentin|amoxicillin[- ]clavulanate)\b/i;
const generalMedicationAllergyPattern =
  /\b(?:medication|medicine|drug|prescription)\s+(?:or\s+drug\s+)?allerg(?:y|ies|ic)\b|\ballerg(?:y|ies|ic)\b.{0,25}\b(?:medication|medicine|drug|prescription)\b/i;

function validatesEstablishedPenicillinAllergyStatus(
  result: Pick<AiFacultyCriterionEvaluation, "learnerEvidenceMessageIds"> &
    Partial<Pick<AiFacultyCriterionEvaluation, "contextualPatientMessageIds">>,
  messages: FacultyEvaluationMessage[],
) {
  const learnerIds = new Set(result.learnerEvidenceMessageIds);
  const patientIds = new Set(result.contextualPatientMessageIds ?? []);

  return messages.some((message, learnerIndex) => {
    const isPenicillinClassInquiry = penicillinClassPattern.test(message.content);
    const isGeneralMedicationAllergyInquiry =
      generalMedicationAllergyPattern.test(message.content);
    if (
      message.role !== "student" ||
      !learnerIds.has(message.id) ||
      !(isPenicillinClassInquiry || isGeneralMedicationAllergyInquiry)
    ) {
      return false;
    }

    const response = messages
      .slice(learnerIndex + 1)
      .find((candidate) => candidate.role === "student" || candidate.role === "patient");

    return Boolean(
      response?.role === "patient" &&
        patientIds.has(response.id) &&
        response.content.trim().length > 0 &&
        (isPenicillinClassInquiry ||
          explicitPenicillinStatusPattern.test(response.content)),
    );
  });
}

const rejectedGenericLearnerPatterns = [
  /^\s*(?:what brings you in|what seems to be the problem|tell me what happened|how can i help(?: you)?(?: today)?|anything else)\s*[?.!]*\s*$/i,
];

const questionPattern = /(?:\?|^\s*(?:what|when|where|why|how|which|who|do|does|did|is|are|was|were|can|could|have|has|had)\b|\b(?:do|does|did|can|could|have|has|had|are|were|will|would) you\b|\byou (?:haven't|have not|don't|do not|aren't|are not|didn't|did not)\b)/i;
const examinationStatementPattern = /\b(?:i (?:see|observe|notice|find|examined|palpated)|on (?:exam|examination)|the exam (?:shows|reveals)|there is|there are)\b/i;
const speculativeConclusionQuestionPattern = /\b(?:could|would|might|may|is) this (?:be|mean)\b/i;
const recommendationPattern = /\b(?:i (?:recommend|would|will|can|plan to)|we (?:should|need to|will|can)|you (?:should|need to)|let(?:'s| us)|plan is|start|begin|give|administer|order|obtain|refer|consult|perform|proceed|offer)\b/i;
const negatedRecommendationPattern = /\b(?:do not|don't|would not|wouldn't|not recommend|no need (?:for|to)|is not needed|isn't needed|avoid)\b/i;
const conclusionPattern = /\b(?:i (?:think|believe|suspect|diagnose|conclude)|this (?:is|looks|sounds)|you (?:have|may have)|the (?:diagnosis|airway|case|condition)|it (?:is|looks|sounds))\b/i;

export function validateExplicitLearnerEvidence({
  criterion,
  result,
  messages,
}: {
  criterion: FacultyRubricCriterion;
  result: Pick<AiFacultyCriterionEvaluation, "learnerEvidenceMessageIds">;
  messages: FacultyEvaluationMessage[];
}) {
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const learnerMessages = result.learnerEvidenceMessageIds
    .map((messageId) => messagesById.get(messageId))
    .filter(
      (message): message is FacultyEvaluationMessage => message?.role === "student",
    );

  if (learnerMessages.length === 0) {
    return { valid: false, reason: "missing-explicit-learner-evidence" } as const;
  }

  const specificLearnerMessages = learnerMessages.filter(
    (message) =>
      !rejectedGenericLearnerPatterns.some((pattern) =>
        pattern.test(message.content.trim()),
      ),
  );
  if (specificLearnerMessages.length === 0) {
    return { valid: false, reason: "generic-learner-evidence" } as const;
  }

  const relevantMessages = specificLearnerMessages.filter((message) =>
    directlyReferencesCriterion(message.content, criterion),
  );
  if (relevantMessages.length === 0) {
    return { valid: false, reason: "unrelated-learner-evidence" } as const;
  }

  const structurallyValid = relevantMessages.some((message) => {
    const content = message.content;
    switch (criterion.evaluationMode) {
      case "conversation-question":
      case "shared-decision-making":
        return questionPattern.test(content);
      case "finding-elicitation":
        return (
          (questionPattern.test(content) &&
            !speculativeConclusionQuestionPattern.test(content)) ||
          examinationStatementPattern.test(content)
        );
      case "clinical-statement":
        return !questionPattern.test(content) && conclusionPattern.test(content);
      case "recommendation":
        if (criterion.id === "C3-MP-002") {
          return /\b(?:recommend|take|use|give|start|try|should|can)\b.{0,45}\b(?:acetaminophen|tylenol)\b|\b(?:acetaminophen|tylenol)\b.{0,45}\b(?:recommend|take|use|give|start|try|should|can)\b/i.test(
            content,
          );
        }
        if (criterion.id === "C3-MP-007") {
          return (
            /\b(?:recommend|take|use|give|start|try|should|can)\b.{0,45}\b(?:ibuprofen|advil|motrin|nsaid\w*|naproxen|aleve|ketorolac|toradol|diclofenac|celecoxib|celebrex)\b|\b(?:ibuprofen|advil|motrin|nsaid\w*|naproxen|aleve|ketorolac|toradol|diclofenac|celecoxib|celebrex)\b.{0,45}\b(?:recommend|take|use|give|start|try|should|can)\b/i.test(
              content,
            ) && !negatedRecommendationPattern.test(content)
          );
        }
        return (
          recommendationPattern.test(content) &&
          !negatedRecommendationPattern.test(content)
        );
      case "patient-education":
        return !questionPattern.test(content);
      case "procedural-choice":
        return recommendationPattern.test(content);
      default:
        return true;
    }
  });

  return structurallyValid
    ? ({ valid: true } as const)
    : ({ valid: false, reason: "learner-behavior-not-explicit" } as const);
}

function directlyReferencesCriterion(
  content: string,
  criterion: FacultyRubricCriterion,
) {
  const normalizedContent = normalizeForMatch(content);
  const concepts = [
    ...(criterion.acceptedConcepts ?? []),
    criterion.reportLabel,
    criterion.title,
  ].filter((value): value is string => Boolean(value));

  return concepts.some((concept) => {
    const meaningfulWords = normalizeForMatch(concept)
      .split(" ")
      .filter((word) => word.length >= 4 && !conceptStopWords.has(word));
    return meaningfulWords.some((word) => normalizedContent.includes(word));
  });
}

const conceptStopWords = new Set([
  "asked",
  "about",
  "elicited",
  "recognized",
  "recommended",
  "offered",
  "explained",
  "selected",
  "appropriate",
  "patient",
  "available",
  "findings",
]);

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function hasTargetedSystemicInquiry(
  result: Pick<AiFacultyCriterionEvaluation, "learnerEvidenceMessageIds">,
  messages: FacultyEvaluationMessage[],
) {
  return validateTargetedSemanticEvidence({
    criterionName: "asked-about-fever",
    criterionId: "C1-IG-001",
    result,
    messages,
  }).valid;
}

export function validateSemanticEvidenceRuleRegistry(
  rubrics: Array<{ criteria: Array<{ id: string }> }>,
  rulesToValidate: SemanticEvidenceRule[] = semanticEvidenceRules,
) {
  const counts = new Map<string, number>();
  for (const rubric of rubrics) {
    for (const criterion of rubric.criteria) {
      counts.set(criterion.id, (counts.get(criterion.id) ?? 0) + 1);
    }
  }
  const errors: string[] = [];
  const assigned = new Set<string>();
  for (const rule of rulesToValidate) {
    for (const criterionId of rule.criterionIds ?? []) {
      const count = counts.get(criterionId) ?? 0;
      if (count === 0) errors.push(`unknown-criterion-id:${criterionId}`);
      if (count > 1) errors.push(`ambiguous-rubric-id:${criterionId}:${count}`);
      if (assigned.has(criterionId)) errors.push(`duplicate-rule-id:${criterionId}`);
      assigned.add(criterionId);
    }
  }
  return { valid: errors.length === 0, errors };
}
