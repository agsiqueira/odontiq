import type { CaseUrgency } from "@/data/cases";
import type { ConversationMessage } from "@/lib/conversationEngine";

export type MentorGuidanceCategory =
  | "assessment"
  | "diagnosis"
  | "differential"
  | "urgency"
  | "safety"
  | "management"
  | "referral"
  | "follow-up";

export type MentorInterventionEvaluation = {
  shouldIntervene: boolean;
  missingCategories: MentorGuidanceCategory[];
  promptKey?: string;
  promptText?: string;
};

type MentorInterventionCase = {
  urgency: CaseUrgency;
};

const assessmentLanguagePattern =
  /\b(assessment|assess|i think|it seems|it sounds|likely|could be|may be|might be|concerned|diagnos|impression|differential)\b/i;
const managementLanguagePattern =
  /\b(plan|next step|recommend|treat|treatment|manage|management|refer|referral|emergency|urgent|hospital|antibiotic|drain|x-?ray|radiograph|follow up|follow-up|come back|return if|safety)\b/i;

export function evaluateMentorIntervention({
  patientCase,
  conversationHistory,
  interventionAlreadyShown,
}: {
  patientCase: MentorInterventionCase;
  conversationHistory: ConversationMessage[];
  interventionAlreadyShown: boolean;
}): MentorInterventionEvaluation {
  if (interventionAlreadyShown) {
    return {
      shouldIntervene: false,
      missingCategories: [],
    };
  }

  const studentText = conversationHistory
    .filter((message) => message.role === "student")
    .map((message) => message.text)
    .join("\n");

  if (hasMeaningfulAssessmentOrPlanLanguage(studentText)) {
    return {
      shouldIntervene: false,
      missingCategories: [],
    };
  }

  const promptKey = promptKeyForUrgency(patientCase.urgency);
  const prompt = MENTOR_INTERVENTION_PROMPTS[promptKey];

  return {
    shouldIntervene: true,
    missingCategories: prompt.categories,
    promptKey,
    promptText: prompt.text,
  };
}

export function getMentorGuidanceBullets(categories: MentorGuidanceCategory[]) {
  return categories
    .map((category) => MENTOR_GUIDANCE_CATEGORY_LABELS[category])
    .filter((label, index, labels) => labels.indexOf(label) === index);
}

function hasMeaningfulAssessmentOrPlanLanguage(studentText: string) {
  return (
    assessmentLanguagePattern.test(studentText) ||
    managementLanguagePattern.test(studentText)
  );
}

function promptKeyForUrgency(urgency: CaseUrgency) {
  if (urgency === "Emergency") {
    return "high-risk";
  }

  if (urgency === "Urgent") {
    return "diagnostic-urgent";
  }

  return "general";
}

const MENTOR_INTERVENTION_PROMPTS = {
  "high-risk": {
    text: "Before you finish, explain your clinical assessment, how urgent the situation may be, and the immediate next steps you recommend.",
    categories: ["assessment", "urgency", "management", "referral", "safety"],
  },
  "diagnostic-urgent": {
    text: "Before ending the consultation, explain what you think may be causing the symptoms and how you would investigate or manage them.",
    categories: ["assessment", "diagnosis", "management", "follow-up"],
  },
  general: {
    text: "Before concluding, make sure the patient understands your assessment and the care you recommend next.",
    categories: ["assessment", "management", "follow-up"],
  },
} as const satisfies Record<
  string,
  {
    text: string;
    categories: MentorGuidanceCategory[];
  }
>;

const MENTOR_GUIDANCE_CATEGORY_LABELS: Record<MentorGuidanceCategory, string> = {
  assessment: "your clinical assessment",
  diagnosis: "what you think may be causing the symptoms",
  differential: "other reasonable causes you are considering",
  urgency: "whether the situation may be urgent",
  safety: "safety concerns or warning signs",
  management: "the next steps or care you recommend",
  referral: "whether referral or escalation is needed",
  "follow-up": "how the patient should follow up",
};
