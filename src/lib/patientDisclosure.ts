import type { CaseData } from "../data/cases";
import type { ConversationMessage } from "./conversationEngine";

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

export type ProviderMessageIntent =
  | "question"
  | "instruction"
  | "diagnosis_explanation"
  | "treatment_plan"
  | "medication_plan"
  | "disposition_plan"
  | "patient_education"
  | "reassurance"
  | "closing"
  | "other";

export type PatientDisclosureState = {
  alreadyDisclosed: PatientDisclosureFact[];
  allowedThisTurn: PatientDisclosureFact[];
  latestTopics: PatientDisclosureTopic[];
  isBroadQuestion: boolean;
  asksRestrictedClinicalInterpretation: boolean;
  providerMessageIntent: ProviderMessageIntent;
};

export type InternalFact = PatientDisclosureFact & {
  aliases: string[];
  broadEligible: boolean;
  order: number;
  questionIntents: string[];
  canonicalFactIds?: string[];
};

const QUESTION_INTENT_PATTERNS: Record<string, RegExp> = {
  breathing: /\b(breath|breathing|short of breath|dyspnea)\b/i,
  positional_breathing: /\b(lie|lying|lay|flat|recline|back)\b.*\b(breath\w*|chok\w*)|\b(breath\w*|chok\w*)\b.*\b(lie|lying|lay|flat|recline|back)\b/i,
  swallowing: /\b(swallow|swallowing|dysphagia)\b/i,
  swallowing_liquids: /\b(swallow|swallowing)\b.*\b(liquid|water|drink|sip)|\b(liquid|water|drink|sip)\b.*\b(swallow|swallowing)\b/i,
  drooling: /\b(drool|drooling|saliva)\b/i,
  voice_change: /\b(voice|muffled|speaking|speech|sound different)\b/i,
  noisy_breathing: /\b(stridor|noisy breathing|noise when.*breath|breath.*noise)\b/i,
  fever: /\b(fever|feverish|temperature)\b/i,
  chills: /\b(chill|chills|shiver|shivering)\b/i,
  systemic_illness: /\b(feel sick|feeling sick|weak|fatigue|unwell|systemic)\b/i,
  swelling_location: /\b(where|location|side|under.*jaw|submandibular|sublingual)\b.*\b(swell|swelling)|\b(swell|swelling)\b.*\b(where|location|side|under.*jaw|submandibular|sublingual)\b/i,
  swelling_progression: /\b(swell|swelling)\b.*\b(worse|worsen|spread|progress|change|fast|quick)|\b(worse|worsen|spread|progress|change|fast|quick)\b.*\b(swell|swelling)\b/i,
  medical_conditions: /\b(medical|health)\b.*\b(history|condition|problem)|\b(diabetes|hypertension|high blood pressure)\b/i,
  opioid_history: /\b(opioids?|opiates?|narcotics?|prescription (?:painkillers?|pain (?:medication|medicine|pills?))|opioid (?:use|misuse|abuse|dependence|addiction))\b/i,
  medications: /\b(medication|medicine|meds|what do you take|taking)\b/i,
  allergies: /\b(allerg|penicillin)\b/i,
  smoking: /\b(smok|smoking|tobacco|cigarette)\b/i,
  dental_access: /\b(afford|cost|insurance|why.*(?:treated|removed|extracted)|dentist|appointment|access)\b/i,
  tongue_position: /\b(tongue)\b.*\b(push|pushed|up|elevat|back|posterior)|\b(push|pushed|elevat|posterior)\b.*\b(tongue)\b/i,
  thermal: /\b(cold|hot|heat|thermal|temperature sensitivity)\b/i,
  biting: /\b(bite|biting|chew|chewing|tap|tapping|pressure)\b/i,
  pain_quality: /\b(what.*feel|describe.*pain|quality|throbb|sharp|dull|aching)\b/i,
  pain_severity: /\b(how bad|how severe|severity|scale|rate|out of ten|\/10)\b/i,
  radiation: /\b(travel|radiat|spread anywhere|go anywhere|ear)\b/i,
  ibuprofen_tolerance: /\b(ibuprofen|advil|motrin|nsaid)\b.*\b(bother|upset|stomach|tolerat|reaction)|\b(bother|upset|stomach|tolerat|reaction)\b.*\b(ibuprofen|advil|motrin|nsaid)\b/i,
  root_canal_history: /\b(root canal|nerve removed|had.*crown|crown.*history)\b/i,
  symptom_sequence: /\b(stop|stopped|went away|come back|came back|return|returned|before|earlier episode)\b/i,
  hard_object_injury: /\b(bite|bit|biting)\b.*\b(hard|object|food|something)|\b(hard|object|food|something)\b.*\b(bite|bit|biting)\b/i,
  allergy_reaction: /\b(reaction|what happens|hives|rash|anaphylaxis)\b/i,
  drainage: /\b(pus|purulence|drain|drainage|discharge|bad taste|sinus tract)\b/i,
  patient_goal: /\b(save|keep|lose|losing|goal|want.*tooth)\b/i,
  cold_current: /\b(cold)\b.*\b(now|still|currently|anymore)|\b(now|still|currently|anymore)\b.*\b(cold)\b/i,
  cold_prior: /\b(cold)\b.*\b(before|earlier|used to|previously)|\b(before|earlier|used to|previously)\b.*\b(cold)\b/i,
  spontaneous_pain: /\b(on its own|without.*touch|nothing touching|spontaneous(?:ly)?|unprovoked|starts by itself)\b/i,
  nocturnal_pain: /\b(wake|wakes|waking|night|sleep|sleeping)\b/i,
  dental_visit_history: /\b(last|when)\b.*\b(dentist|dental visit)|\b(dentist|dental visit)\b.*\b(last|when|years? ago)\b/i,
  current_pain: /\b(constant|all the time|continuous|does it stop|pain now)\b/i,
  temperature_checked: /\b(check|checked|measure|measured|thermometer)\b.*\b(temperature|fever)|\b(temperature|fever)\b.*\b(check|checked|measure|measured|thermometer)\b/i,
  mouth_opening: /\b(open|opening)\b.*\b(mouth|jaw)|\b(trismus)\b/i,
  facial_swelling: /\b(cheek|face|facial)\b.*\b(swell|swelling|puffy)|\b(swell|swelling|puffy)\b.*\b(cheek|face|facial)\b/i,
  pain: /\b(pain|hurt|ache|severity|scale|rate)\b/i,
  duration: /\b(how long|duration|when.*start|days?|hours?)\b/i,
  location: /\b(where|which tooth|what tooth|side|left|right|upper|lower)\b/i,
};

const BROAD_QUESTION_PATTERN =
  /\b(tell me more|what else|anything else|can you explain|say more|more about|elaborate|what'?s going on|what is going on|what brings|why are you here|how can i help|main problem|chief complaint|what is bothering you|what seems to be the problem)\b/i;

const RESTRICTED_INTERPRETATION_PATTERN =
  /\b(diagnos|diagnosis|differential|impression|what is it|what do you think it is|treatment plan|management plan|care plan|what'?s the plan|what is the plan|what should i do|what do we do|should i prescribe|should i refer|procedure|refer|referral)\b/i;

const QUESTION_PATTERN =
  /^(?:who|what|when|where|why|how|which|do|does|did|are|is|was|were|can|could|would|will|have|has|had|tell me|describe)\b/i;
const COMPREHENSION_QUESTION_PATTERN =
  /^(?:(?:do|can) you understand|does that make sense|is that clear)\b/i;
const DISPOSITION_PLAN_PATTERN =
  /\b(admit|admitted|admission|hospital|discharge|go home|send you home|refer|referral|oral surgeon|follow[- ]?up|come back|return in|see you again)\b/i;
const MEDICATION_PLAN_PATTERN =
  /\b(prescrib|antibiotic|pain medication|pain medicine|start you on|medication plan|take .+ (?:days?|times?))\b/i;
const TREATMENT_PLAN_PATTERN =
  /\b(treatment|procedure|extract|extraction|remove the tooth|removed|root canal|drain|incision|operate|surgery)\b/i;
const DIAGNOSIS_EXPLANATION_PATTERN =
  /\b(diagnos|appears? to be|caused by|this is (?:an?|the)|you have|infection|condition)\b/i;
const REASSURANCE_PATTERN =
  /\b(youll be (?:all right|okay)|do not worry|dont worry|well take care of you|this should help|reassur)\b/i;
const CLOSING_PATTERN =
  /\b(thank you for coming|thats all|were all done|take care|see you (?:soon|next|then)|goodbye)\b/i;
const INSTRUCTION_PATTERN =
  /^(?:please\s+)?(?:take|use|avoid|call|return|come back|keep|rinse|stop|start|continue|do not|don'?t|make sure)\b/i;
const EDUCATION_PATTERN =
  /\b(the reason|this means|because|what to expect|it is important|you should know)\b/i;

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
  const disclosedFactIds = inferDisclosedFactIds({ facts, conversation });
  const latestClassification = classifyQuestion(latestStudentMessage);
  const allowedFacts = selectAllowedFacts({
    caseId: caseData.metadata.id,
    facts,
    classification: latestClassification,
    disclosedFactIds,
    question: latestStudentMessage,
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
    providerMessageIntent: latestClassification.providerMessageIntent,
  };
}

export function extractPatientFacts(caseData: CaseData): InternalFact[] {
  const history = caseData.supportingInfo.history;
  const facts: InternalFact[] = [];

  addFact(facts, {
    id: "chief_complaint",
    topic: "chief_complaint",
    text: caseData.metadata.chiefComplaint,
    order: 0,
    broadEligible: true,
    questionIntents: [],
  });
  addFact(facts, {
    id: "history.pain",
    topic: "pain",
    text: history.pain,
    order: 10,
    broadEligible: true,
    questionIntents: [],
  });
  addFact(facts, {
    id: "history.onset",
    topic: "onset_duration",
    text: history.onset,
    order: 20,
    broadEligible: true,
    questionIntents: [],
  });
  addFact(facts, {
    id: "history.duration",
    topic: "onset_duration",
    text: history.duration,
    order: 21,
    broadEligible: true,
    questionIntents: [],
  });
  addFact(facts, {
    id: "history.medications",
    topic: "medications",
    text: history.medications,
    order: 50,
    broadEligible: false,
    questionIntents: [],
  });
  addFact(facts, {
    id: "history.allergies",
    topic: "allergies",
    text: history.allergies,
    order: 60,
    broadEligible: false,
    questionIntents: [],
  });
  addFact(facts, {
    id: "history.medicalHistory",
    topic: "medical_history",
    text: history.medicalHistory,
    order: 70,
    broadEligible: false,
    questionIntents: [],
  });
  addFact(facts, {
    id: "history.dentalHistory",
    topic: "dental_history",
    text: history.dentalHistory,
    order: 80,
    broadEligible: false,
    questionIntents: [],
  });
  addFact(facts, {
    id: "history.socialHistory",
    topic: "social_history",
    text: history.socialHistory,
    order: 90,
    broadEligible: false,
    questionIntents: [],
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
      questionIntents: [],
    });
  });

  caseData.supportingInfo.patientFacts?.forEach((fact, index) => {
    addFact(facts, {
      ...fact,
      order: 200 + index,
      broadEligible: fact.broadEligible ?? false,
    });
  });

  const structuredTopics = new Set<PatientDisclosureTopic>(
    caseData.supportingInfo.patientFacts?.map((fact) => fact.topic) ?? [],
  );

  return dedupeFacts(
    facts.filter(
      (fact) =>
        !structuredTopics.has(fact.topic) ||
        (!fact.id.startsWith("history.") && !fact.id.startsWith("hpiFacts.")),
    ),
  )
    .sort((left, right) => left.order - right.order);
}

export function topicFromPatientFact(text: string): PatientDisclosureTopic | undefined {
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

export function classifyQuestion(question: string) {
  const normalizedQuestion = normalizeText(question);
  const providerMessageIntent = classifyProviderMessageIntent(question);
  const topics = new Set<PatientDisclosureTopic>();

  if (providerMessageIntent === "question") {
    for (const [topic, aliases] of Object.entries(TOPIC_ALIASES)) {
      if (aliases.some((alias) => matchesAlias(normalizedQuestion, alias))) {
        topics.add(topic as PatientDisclosureTopic);
      }
    }
  }

  return {
    topics: refineTopics(normalizedQuestion, topics),
    questionIntents:
      providerMessageIntent === "question"
        ? refineQuestionIntents(Object.entries(QUESTION_INTENT_PATTERNS)
            .filter(([, pattern]) => pattern.test(normalizedQuestion))
            .map(([intent]) => intent))
        : [],
    isBroadQuestion:
      providerMessageIntent === "question" &&
      BROAD_QUESTION_PATTERN.test(normalizedQuestion),
    asksRestrictedClinicalInterpretation:
      providerMessageIntent === "question" &&
      !COMPREHENSION_QUESTION_PATTERN.test(question.trim()) &&
      RESTRICTED_INTERPRETATION_PATTERN.test(normalizedQuestion),
    providerMessageIntent,
  };
}

function refineQuestionIntents(intents: string[]) {
  const refined = new Set(intents);
  if (refined.has("positional_breathing")) refined.delete("breathing");
  if (refined.has("noisy_breathing")) refined.delete("breathing");
  if (refined.has("swallowing_liquids")) refined.delete("swallowing");
  if (refined.has("temperature_checked")) refined.delete("fever");
  if (refined.has("location")) refined.delete("pain");
  if (refined.has("biting")) refined.delete("pain");
  if (refined.has("pain_quality")) refined.delete("pain");
  if (refined.has("pain_severity")) refined.delete("pain");
  if (refined.has("ibuprofen_tolerance")) refined.delete("medications");
  if (refined.has("allergy_reaction")) refined.delete("allergies");
  if (refined.has("cold_current") || refined.has("cold_prior")) {
    refined.delete("symptom_sequence");
  }
  if (refined.has("hard_object_injury")) refined.delete("biting");
  if (refined.has("spontaneous_pain")) refined.delete("pain");
  if (refined.has("nocturnal_pain")) refined.delete("pain");
  return Array.from(refined);
}

export function classifyProviderMessageIntent(
  message: string,
): ProviderMessageIntent {
  const trimmedMessage = message.trim();
  const normalizedMessage = normalizeText(message);

  if (
    !/^do not\b/i.test(trimmedMessage) &&
    (trimmedMessage.endsWith("?") || QUESTION_PATTERN.test(trimmedMessage))
  ) {
    return "question";
  }
  if (CLOSING_PATTERN.test(normalizedMessage)) return "closing";
  if (REASSURANCE_PATTERN.test(normalizedMessage)) return "reassurance";
  if (DISPOSITION_PLAN_PATTERN.test(normalizedMessage)) {
    return "disposition_plan";
  }
  if (MEDICATION_PLAN_PATTERN.test(normalizedMessage)) {
    return "medication_plan";
  }
  if (TREATMENT_PLAN_PATTERN.test(normalizedMessage)) return "treatment_plan";
  if (DIAGNOSIS_EXPLANATION_PATTERN.test(normalizedMessage)) {
    return "diagnosis_explanation";
  }
  if (INSTRUCTION_PATTERN.test(trimmedMessage)) return "instruction";
  if (EDUCATION_PATTERN.test(normalizedMessage)) return "patient_education";
  return "other";
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

export function selectAllowedFacts({
  caseId,
  facts,
  classification,
  disclosedFactIds,
  question,
}: {
  caseId: string;
  facts: InternalFact[];
  classification: ReturnType<typeof classifyQuestion>;
  disclosedFactIds: Set<string>;
  question: string;
}) {
  if (classification.asksRestrictedClinicalInterpretation) {
    return [];
  }

  const caseSpecificFacts =
    classification.providerMessageIntent === "question"
      ? selectCaseSpecificAllowedFacts({
          caseId,
          facts: facts.filter((fact) => !disclosedFactIds.has(fact.id)),
          question,
        })
      : undefined;

  if (caseSpecificFacts) {
    return caseSpecificFacts;
  }

  const prerequisiteFacts = facts.filter(
    (fact) =>
      fact.questionIntents.length > 0 &&
      fact.questionIntents.some((intent) =>
        classification.questionIntents.includes(intent),
      ) &&
      !disclosedFactIds.has(fact.id),
  );

  if (prerequisiteFacts.length > 0) {
    return classification.isBroadQuestion
      ? prerequisiteFacts.slice(0, 1)
      : prerequisiteFacts;
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

function inferDisclosedFactIds({ facts, conversation }: { facts: InternalFact[]; conversation: ConversationMessage[] }) {
  const disclosedFactIds = new Set<string>();

  for (const message of conversation.filter((item) => item.role === "patient")) {
    for (const fact of facts) {
      if (patientResponseSupportsFact(message.text, fact.text)) {
        disclosedFactIds.add(fact.id);
      }
    }
  }

  return disclosedFactIds;
}

function patientResponseSupportsFact(response: string, factText: string) {
  const ignored = new Set(["the", "a", "an", "and", "or", "is", "are", "it", "my", "i", "to", "of", "for", "when", "that"]);
  const factTokens = normalizeText(factText).split(" ").filter((token) => token.length > 2 && !ignored.has(token));
  const responseTokens = new Set(normalizeText(response).split(" "));
  const overlap = factTokens.filter((token) => responseTokens.has(token)).length;
  return factTokens.length > 0 && overlap / factTokens.length >= 0.5;
}

function selectCaseSpecificAllowedFacts({
  caseId,
  facts,
  question,
}: {
  caseId: string;
  facts: InternalFact[];
  question: string;
}): InternalFact[] | undefined {
  if (caseId === "case-01" && QUESTION_INTENT_PATTERNS.opioid_history.test(question)) {
    return facts.filter((fact) => fact.id === "c1.opioid");
  }

  if (caseId === "case-03") {
    const normalizedQuestion = normalizeText(question);
    if (/\bwhat medications? did you take\b|\bwhat did you take\b/.test(normalizedQuestion)) {
      return facts.filter((fact) => fact.id === "c3.pepcid" || fact.id === "c3.ibuprofen");
    }
    if (/\b(ibuprofen|advil|motrin|nsaid)\b/.test(normalizedQuestion)) {
      return facts.filter((fact) => fact.id === "c3.ibuprofen");
    }
    if (/\b(medication|medications|medicine|meds|what do you take|taking)\b/.test(normalizedQuestion)) {
      return facts.filter((fact) => fact.id === "c3.pepcid");
    }
  }

  if (caseId !== "case-05") {
    return undefined;
  }

  const normalizedQuestion = normalizeText(question);
  if (/\bwhat makes (?:the )?pain worse\b/.test(normalizedQuestion)) {
    return facts.filter((fact) => ["c5.cold", "c5.chewing", "c5.biting"].includes(fact.id));
  }
  if (/\bchew(?:ing)?\b/.test(normalizedQuestion) && !/\b(bite|biting|tap|tapping|percussion)\b/.test(normalizedQuestion)) {
    return facts.filter((fact) => fact.id === "c5.chewing");
  }
  if (/\b(bite|biting|tap|tapping|percussion)\b/.test(normalizedQuestion)) {
    return facts.filter((fact) => fact.id === "c5.biting");
  }
  if (/\bhow many\b.*\b(seconds?|minutes?)\b|\bhow long\b.*\b(?:last|keep hurting)\b/.test(normalizedQuestion)) {
    return facts.filter((fact) => fact.id === "c5.lingering");
  }
  const asksAboutThermalResponse =
    /\b(cold|chilly|chilled|hot|heat|temperature|thermal|sensitive|sensitivity)\b/.test(
      normalizedQuestion,
    ) || /\bwhat makes (?:the )?pain worse\b/.test(normalizedQuestion);

  if (!asksAboutThermalResponse) {
    return undefined;
  }

  const asksAboutLingeringColdPain =
    /\b(linger|lingering)\b/.test(normalizedQuestion) ||
    /\bafter (?:the )?cold\b/.test(normalizedQuestion) ||
    /\bcold (?:is|has been) (?:gone|removed)\b/.test(normalizedQuestion) ||
    /\bstop(?:s|ped|ping)? (?:as soon|immediately|right away)\b/.test(
      normalizedQuestion,
    ) ||
    /\bkeep(?:s|ing)? (?:hurting|going)\b/.test(normalizedQuestion) ||
    (/\bhow long\b/.test(normalizedQuestion) &&
      /\b(cold|temperature|stimulus)\b/.test(normalizedQuestion));
  const asksWhatColdDoes =
    /\bwhat happens\b/.test(normalizedQuestion) &&
    /\bcold\b/.test(normalizedQuestion);
  const mentionsCold = /\bcold\b/.test(normalizedQuestion);
  const mentionsHot = /\b(hot|heat)\b/.test(normalizedQuestion);

  if (asksAboutLingeringColdPain) {
    return facts.filter((fact) => fact.id === "c5.lingering");
  }
  if (asksWhatColdDoes) {
    return facts.filter((fact) => ["c5.cold", "c5.lingering"].includes(fact.id));
  }
  if (mentionsCold) {
    return facts.filter((fact) => fact.id === "c5.cold");
  }
  if (mentionsHot) {
    return [];
  }
  return facts.filter((fact) => fact.id === "c5.cold");
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
