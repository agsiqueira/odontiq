import type { CaseData } from "@/data/cases";
import type { ConversationMessage } from "@/lib/conversationEngine";

export type PatientDisclosureTopic =
  | "chief_complaint"
  | "pain"
  | "onset_duration"
  | "location"
  | "swelling"
  | "trauma_injury"
  | "medications"
  | "allergies"
  | "medical_history"
  | "dental_history"
  | "social_history"
  | "anxiety_emotion";

export type PatientDisclosureFact = {
  id: string;
  topic: PatientDisclosureTopic;
  text: string;
};

export type PatientDisclosureState = {
  alreadyDisclosed: PatientDisclosureFact[];
  allowedThisTurn: PatientDisclosureFact[];
  latestTopics: PatientDisclosureTopic[];
  isBroadQuestion: boolean;
  asksRestrictedClinicalInterpretation: boolean;
};

type InternalFact = PatientDisclosureFact & {
  aliases: string[];
  broadEligible: boolean;
  order: number;
};

const BROAD_QUESTION_PATTERN =
  /\b(tell me more|what else|anything else|can you explain|say more|more about|elaborate|what'?s going on|what is going on|what brings|why are you here|how can i help|main problem|chief complaint|what is bothering you|what seems to be the problem)\b/i;

const RESTRICTED_INTERPRETATION_PATTERN =
  /\b(diagnos|diagnosis|differential|impression|what is it|what do you think it is|treatment plan|management plan|care plan|what'?s the plan|what is the plan|what should i do|what do we do|should i prescribe|should i refer|procedure|refer|referral)\b/i;

const TOPIC_ALIASES: Record<PatientDisclosureTopic, string[]> = {
  chief_complaint: [
    "what brings",
    "why are you here",
    "how can i help",
    "main concern",
    "chief complaint",
    "main problem",
    "problem",
    "bothering you",
  ],
  pain: [
    "pain",
    "hurt",
    "ache",
    "sore",
    "throb",
    "sharp",
    "severity",
    "scale",
    "rate",
    "0 to 10",
    "1 to 10",
  ],
  onset_duration: [
    "when did",
    "when started",
    "start",
    "started",
    "begin",
    "began",
    "onset",
    "how long",
    "duration",
    "how many days",
    "how many weeks",
    "for how long",
  ],
  location: [
    "where",
    "location",
    "located",
    "which tooth",
    "what tooth",
    "area",
    "side",
    "upper",
    "lower",
    "left",
    "right",
  ],
  swelling: [
    "swelling",
    "swollen",
    "puffy",
    "cheek",
    "jaw",
    "face",
    "facial",
    "hot",
  ],
  trauma_injury: [
    "trauma",
    "injury",
    "injured",
    "hit",
    "fell",
    "fall",
    "accident",
    "bite something hard",
    "biting something hard",
    "cracked",
    "broke",
  ],
  medications: [
    "medication",
    "medications",
    "medicine",
    "meds",
    "ibuprofen",
    "acetaminophen",
    "tylenol",
    "advil",
    "painkiller",
    "antibiotic",
    "taken",
    "take anything",
  ],
  allergies: ["allergy", "allergies", "allergic", "penicillin"],
  medical_history: [
    "medical history",
    "health problems",
    "conditions",
    "illnesses",
    "diabetes",
    "hospitalizations",
    "surgeries",
  ],
  dental_history: [
    "dental history",
    "dentist",
    "tooth history",
    "filling",
    "cavity",
    "root canal",
    "extraction",
    "recent dental",
    "dental work",
  ],
  social_history: [
    "social history",
    "smoke",
    "smoking",
    "tobacco",
    "alcohol",
    "drugs",
    "work",
    "job",
    "school",
    "living",
    "chew",
    "eating",
    "drink",
  ],
  anxiety_emotion: [
    "worried",
    "worry",
    "anxious",
    "anxiety",
    "scared",
    "afraid",
    "nervous",
    "concerned",
    "comfortable",
    "feel about",
  ],
};

const BROAD_TOPIC_ORDER: PatientDisclosureTopic[] = [
  "chief_complaint",
  "pain",
  "location",
  "onset_duration",
  "swelling",
  "anxiety_emotion",
];

export function buildPatientDisclosureState({
  caseData,
  conversation,
  latestStudentMessage,
}: {
  caseData: CaseData;
  conversation: ConversationMessage[];
  latestStudentMessage: string;
}): PatientDisclosureState {
  const facts = extractPatientFacts(caseData);
  const disclosedFactIds = inferDisclosedFactIds({
    facts,
    questions: conversation
      .filter((message) => message.role === "student")
      .map((message) => message.text),
  });
  const latestClassification = classifyQuestion(latestStudentMessage);
  const allowedFacts = selectAllowedFacts({
    facts,
    classification: latestClassification,
    disclosedFactIds,
  });
  const allowedFactIds = new Set(allowedFacts.map((fact) => fact.id));
  const alreadyDisclosed = facts.filter(
    (fact) => disclosedFactIds.has(fact.id) && !allowedFactIds.has(fact.id),
  );

  return {
    alreadyDisclosed: alreadyDisclosed.map(publicFact),
    allowedThisTurn: allowedFacts.map(publicFact),
    latestTopics: latestClassification.topics,
    isBroadQuestion: latestClassification.isBroadQuestion,
    asksRestrictedClinicalInterpretation:
      latestClassification.asksRestrictedClinicalInterpretation,
  };
}

function extractPatientFacts(caseData: CaseData): InternalFact[] {
  const history = caseData.supportingInfo.history;
  const facts: InternalFact[] = [];

  addFact(facts, {
    id: "chief_complaint",
    topic: "chief_complaint",
    text: caseData.metadata.chiefComplaint,
    order: 0,
    broadEligible: true,
  });
  addFact(facts, {
    id: "history.pain",
    topic: "pain",
    text: history.pain,
    order: 10,
    broadEligible: true,
  });
  addFact(facts, {
    id: "history.onset",
    topic: "onset_duration",
    text: history.onset,
    order: 20,
    broadEligible: true,
  });
  addFact(facts, {
    id: "history.duration",
    topic: "onset_duration",
    text: history.duration,
    order: 21,
    broadEligible: true,
  });
  addFact(facts, {
    id: "history.medications",
    topic: "medications",
    text: history.medications,
    order: 50,
    broadEligible: false,
  });
  addFact(facts, {
    id: "history.allergies",
    topic: "allergies",
    text: history.allergies,
    order: 60,
    broadEligible: false,
  });
  addFact(facts, {
    id: "history.medicalHistory",
    topic: "medical_history",
    text: history.medicalHistory,
    order: 70,
    broadEligible: false,
  });
  addFact(facts, {
    id: "history.dentalHistory",
    topic: "dental_history",
    text: history.dentalHistory,
    order: 80,
    broadEligible: false,
  });
  addFact(facts, {
    id: "history.socialHistory",
    topic: "social_history",
    text: history.socialHistory,
    order: 90,
    broadEligible: false,
  });

  caseData.supportingInfo.hpiFacts.forEach((text, index) => {
    const topic = topicFromPatientFact(text);

    if (!topic) {
      return;
    }

    addFact(facts, {
      id: `hpiFacts.${index}`,
      topic,
      text,
      order: 100 + index,
      broadEligible: BROAD_TOPIC_ORDER.includes(topic),
    });
  });

  return dedupeFacts(facts).sort((left, right) => left.order - right.order);
}

function topicFromPatientFact(text: string): PatientDisclosureTopic | undefined {
  const normalizedText = normalizeText(text);

  if (
    /\b(worried|worry|anxious|anxiety|scared|afraid|nervous|comfortable)\b/.test(
      normalizedText,
    )
  ) {
    return "anxiety_emotion";
  }

  if (
    /\b(trauma|injury|injured|hit|fell|fall|accident|biting something hard|bit something hard|cracked|broke)\b/.test(
      normalizedText,
    )
  ) {
    return "trauma_injury";
  }

  if (/\b(swelling|swollen|cheek|jaw|face|facial|hot)\b/.test(normalizedText)) {
    return "swelling";
  }

  if (
    /\b(upper|lower|left|right|side|tooth|teeth|jaw|cheek|ear|area)\b/.test(
      normalizedText,
    )
  ) {
    return "location";
  }

  if (
    /\b(pain|sensitivity|sensitive|ache|sharp|throb|sore|hurts?|biting|chewing|cold|hot)\b/.test(
      normalizedText,
    )
  ) {
    return "pain";
  }

  return undefined;
}

function dedupeFacts(facts: InternalFact[]) {
  const seenTexts = new Set<string>();
  const uniqueFacts: InternalFact[] = [];

  for (const fact of facts) {
    const key = `${fact.topic}:${normalizeText(fact.text)}`;

    if (seenTexts.has(key)) {
      continue;
    }

    seenTexts.add(key);
    uniqueFacts.push(fact);
  }

  return uniqueFacts;
}

function classifyQuestion(question: string) {
  const normalizedQuestion = normalizeText(question);
  const topics = new Set<PatientDisclosureTopic>();

  for (const [topic, aliases] of Object.entries(TOPIC_ALIASES)) {
    if (aliases.some((alias) => matchesAlias(normalizedQuestion, alias))) {
      topics.add(topic as PatientDisclosureTopic);
    }
  }

  return {
    topics: refineTopics(normalizedQuestion, topics),
    isBroadQuestion: BROAD_QUESTION_PATTERN.test(normalizedQuestion),
    asksRestrictedClinicalInterpretation:
      RESTRICTED_INTERPRETATION_PATTERN.test(normalizedQuestion),
  };
}

function refineTopics(
  normalizedQuestion: string,
  topics: Set<PatientDisclosureTopic>,
) {
  if (topics.has("allergies") && /\ballerg/.test(normalizedQuestion)) {
    topics.delete("medications");
  }

  if (
    topics.has("medications") &&
    topics.has("pain") &&
    /\b(pain medicine|pain medication|pain meds|painkiller|taken|take anything)\b/.test(
      normalizedQuestion,
    ) &&
    !/\b(how bad|severity|scale|rate|0 to 10|1 to 10|describe|feel like)\b/.test(
      normalizedQuestion,
    )
  ) {
    topics.delete("pain");
  }

  return Array.from(topics);
}

function selectAllowedFacts({
  facts,
  classification,
  disclosedFactIds,
}: {
  facts: InternalFact[];
  classification: ReturnType<typeof classifyQuestion>;
  disclosedFactIds: Set<string>;
}) {
  if (classification.asksRestrictedClinicalInterpretation) {
    return [];
  }

  if (classification.topics.length > 0) {
    const matchingFacts = facts.filter(
      (fact) =>
        classification.topics.includes(fact.topic) &&
        !disclosedFactIds.has(fact.id),
    );

    return classification.isBroadQuestion
      ? matchingFacts.slice(0, 1)
      : matchingFacts;
  }

  if (classification.isBroadQuestion) {
    const nextBroadFact = facts.find(
      (fact) => fact.broadEligible && !disclosedFactIds.has(fact.id),
    );

    return nextBroadFact ? [nextBroadFact] : [];
  }

  return [];
}

function inferDisclosedFactIds({
  facts,
  questions,
}: {
  facts: InternalFact[];
  questions: string[];
}) {
  const disclosedFactIds = new Set<string>();

  for (const question of questions) {
    const classification = classifyQuestion(question);
    const allowedFacts = selectAllowedFacts({
      facts,
      classification,
      disclosedFactIds,
    });

    allowedFacts.forEach((fact) => disclosedFactIds.add(fact.id));
  }

  return disclosedFactIds;
}

function addFact(
  facts: InternalFact[],
  fact: Omit<InternalFact, "aliases">,
) {
  const text = fact.text.trim();

  if (!text) {
    return;
  }

  facts.push({
    ...fact,
    aliases: TOPIC_ALIASES[fact.topic],
    text,
  });
}

function publicFact(fact: InternalFact): PatientDisclosureFact {
  return {
    id: fact.id,
    topic: fact.topic,
    text: fact.text,
  };
}

function matchesAlias(text: string, alias: string) {
  const normalizedAlias = normalizeText(alias);

  if (!normalizedAlias) {
    return false;
  }

  if (normalizedAlias.includes(" ")) {
    return text.includes(normalizedAlias);
  }

  return new RegExp(`\\b${escapeRegExp(normalizedAlias)}\\b`, "i").test(text);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
