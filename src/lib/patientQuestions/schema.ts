import {
  PATIENT_QUESTION_CONFIDENCE_THRESHOLD,
  type PatientQuestionClassificationResult,
  type PatientQuestionEventId,
  type PatientQuestionEvents,
} from "./types";
import type { PatientQuestionEvidenceAlias } from "./prompt";

export function parsePatientQuestionClassification(input: {
  text: string;
  caseId: string;
  studentMessageId: string;
  allowedEvents: readonly PatientQuestionEventId[];
  evidenceAliases: readonly PatientQuestionEvidenceAlias[];
}): PatientQuestionClassificationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(input.text));
  } catch {
    return failure("invalid-json", input.text);
  }
  if (!isRecord(parsed)) return failure("invalid-json", input.text);

  const safeMetadata = getSafeMetadata(parsed, input.text);
  const allowedTopLevelFields = new Set([
    "schemaVersion",
    "caseId",
    "events",
    "confidence",
    "evidence",
  ]);
  if (
    parsed.schemaVersion !== 1 ||
    Object.keys(parsed).some((key) => !allowedTopLevelFields.has(key))
  ) {
    return { success: false, reason: "unknown-field", safeMetadata };
  }
  if (parsed.caseId !== input.caseId) {
    return { success: false, reason: "case-mismatch", safeMetadata };
  }
  if (!isRecord(parsed.events)) {
    return { success: false, reason: "invalid-event-shape", safeMetadata };
  }
  const parsedEvents = parsed.events;

  const allowedEvents = new Set(input.allowedEvents);
  const suppliedEventNames = Object.keys(parsedEvents);
  if (suppliedEventNames.some((event) => !allowedEvents.has(event as PatientQuestionEventId))) {
    return { success: false, reason: "wrong-case-event", safeMetadata };
  }
  if (
    input.allowedEvents.some((event) => typeof parsedEvents[event] !== "boolean") ||
    suppliedEventNames.length !== input.allowedEvents.length
  ) {
    return { success: false, reason: "invalid-event-shape", safeMetadata };
  }
  if (
    typeof parsed.confidence !== "number" ||
    !Number.isFinite(parsed.confidence) ||
    parsed.confidence < 0 ||
    parsed.confidence > 1
  ) {
    return { success: false, reason: "invalid-confidence", safeMetadata };
  }
  if (parsed.confidence < PATIENT_QUESTION_CONFIDENCE_THRESHOLD) {
    return { success: false, reason: "low-confidence", safeMetadata };
  }
  if (
    !Array.isArray(parsed.evidence) ||
    !parsed.evidence.every((alias) => typeof alias === "string")
  ) {
    return { success: false, reason: "invalid-evidence-alias", safeMetadata };
  }
  const evidenceAliases = parsed.evidence;

  const aliasesByName = new Map(
    input.evidenceAliases.map((entry) => [entry.alias, entry]),
  );
  if (evidenceAliases.some((alias) => !aliasesByName.has(alias))) {
    return {
      success: false,
      reason: "invalid-evidence-alias",
      safeMetadata: { ...safeMetadata, evidenceAliasesValid: false },
    };
  }
  const assertedEventNames = suppliedEventNames.filter(
    (event) => parsedEvents[event] === true,
  ) as PatientQuestionEventId[];
  if (assertedEventNames.length > 0 && evidenceAliases.length === 0) {
    return { success: false, reason: "missing-evidence", safeMetadata };
  }
  const evidenceRoles = new Set(
    evidenceAliases.map((alias) => aliasesByName.get(alias)!.role),
  );
  if (
    assertedEventNames.some((event) =>
      eventRequiresPatientEvidence(event)
        ? !evidenceRoles.has("patient")
        : !evidenceRoles.has("student"),
    )
  ) {
    return { success: false, reason: "incompatible-evidence-role", safeMetadata };
  }
  if (
    assertedEventNames.some((event) =>
      !eventHasSemanticallyCompatibleEvidence(
        event,
        evidenceAliases.map((alias) => aliasesByName.get(alias)!),
        input.evidenceAliases,
      ),
    )
  ) {
    return { success: false, reason: "incompatible-evidence-semantics", safeMetadata };
  }

  const detectedEvents: Partial<PatientQuestionEvents> = {};
  for (const event of input.allowedEvents) {
    detectedEvents[event] = parsedEvents[event] as boolean;
  }
  return {
    success: true,
    classification: {
      schemaVersion: 1,
      caseId: input.caseId,
      analyzedStudentMessageId: input.studentMessageId,
      detectedEvents,
      confidence: parsed.confidence,
      evidenceAliases: [...evidenceAliases],
      evidenceMessageIds: evidenceAliases.map(
        (alias) => aliasesByName.get(alias)!.messageId,
      ),
    },
  };
}

function failure(
  reason: "invalid-json",
  text: string,
): PatientQuestionClassificationResult {
  return {
    success: false,
    reason,
    safeMetadata: { rawOutputLength: text.length },
  };
}

function eventRequiresPatientEvidence(event: PatientQuestionEventId) {
  return event === "patientAgreedToIncisionAndDrainage" || event === "patientPainDescribed";
}

function eventHasSemanticallyCompatibleEvidence(
  event: PatientQuestionEventId,
  evidence: readonly PatientQuestionEvidenceAlias[],
  allEvidence: readonly PatientQuestionEvidenceAlias[],
) {
  if (event === "hospitalAdmissionOrSurgicalManagementDiscussed") {
    return evidence.some((entry) =>
      entry.role === "student" && case1ManagementEvidenceIsCompatible(entry.content),
    );
  }
  if (event === "antibioticsRecommendedAsCurrentPlan") {
    return evidence.some((entry) =>
      entry.role === "student" && case2AntibioticPlanEvidenceIsCompatible(entry.content),
    );
  }
  if (event === "temporaryTreatmentActive") {
    return evidence.some((entry) =>
      entry.role === "student" && case3TemporaryTreatmentEvidenceIsCompatible(entry.content),
    );
  }
  if (event === "incisionAndDrainageProposed") {
    return evidence.some((entry) =>
      entry.role === "student" && case3DrainageProposalEvidenceIsCompatible(entry.content),
    );
  }
  if (event === "patientAgreedToIncisionAndDrainage") {
    return case3DrainageAgreementEvidenceIsCompatible(evidence, allEvidence);
  }
  return true;
}

function case3TemporaryTreatmentEvidenceIsCompatible(content: string) {
  const normalized = content.toLowerCase().replace(/[’]/g, "'");
  const treatmentReference = /\b(?:antibiotics?|antimicrobial (?:treatment|therapy)|local anesthe(?:tic|sia)|dental block|nerve block|mandibular block|inferior alveolar nerve block|acetaminophen|tylenol)\b|\b(?:incision and drainage|i\s*(?:&|and)\s*d)\b|\b(?:drain|drainage|draining)\b.{0,55}\b(?:abscess|infection|pus|pressure)\b|\b(?:abscess|infection|pus|pressure)\b.{0,55}\b(?:drain|drainage|draining)\b/;
  if (!treatmentReference.test(normalized)) return false;

  const rejectedContext = /\b(?:no|not|won't|will not|do not|don't|without|decline(?:d|s)?|refus(?:e|ed|es))\b.{0,80}\b(?:antibiotics?|antimicrobial|anesthe(?:tic|sia)|block|acetaminophen|tylenol|incision|drain|drainage|i\s*(?:&|and)\s*d)\b/.test(normalized)
    || /\b(?:antibiotics?|antimicrobial|anesthe(?:tic|sia)|block|acetaminophen|tylenol|incision|drain|drainage|i\s*(?:&|and)\s*d)\b.{0,80}\b(?:not indicated|not recommended|unnecessary|declined|refused|won't|will not)\b/.test(normalized)
    || /\b(?:may|might|could|possibly|perhaps|consider(?:ed|ing)?|hypothetical(?:ly)?|later|eventually|in the future)\b.{0,100}\b(?:antibiotics?|antimicrobial|anesthe(?:tic|sia)|block|acetaminophen|tylenol|incision|drain|drainage|i\s*(?:&|and)\s*d)\b/.test(normalized)
    || /\bif\b.{0,120}\b(?:antibiotics?|antimicrobial|anesthe(?:tic|sia)|block|acetaminophen|tylenol|incision|drain|drainage|i\s*(?:&|and)\s*d)\b/.test(normalized)
    || /\b(?:have you ever|did you ever|previously|in the past|history of)\b.{0,100}\b(?:antibiotics?|antimicrobial|anesthe(?:tic|sia)|block|acetaminophen|tylenol|incision|drain|drainage|drained|i\s*(?:&|and)\s*d)\b/.test(normalized)
    || /\b(?:antibiotics?|antimicrobial|anesthe(?:tic|sia)|block|acetaminophen|tylenol|incision|drain|drainage|drained|i\s*(?:&|and)\s*d)\b.{0,70}\b(?:before|previously|in the past|history|yesterday|earlier|last (?:week|month|year))\b/.test(normalized)
    || /\b(?:allerg(?:y|ic|ies)|reaction|reacted)\b.{0,70}\b(?:antibiotics?|antimicrobial)\b|\b(?:antibiotics?|antimicrobial)\b.{0,70}\b(?:allerg(?:y|ic|ies)|reaction|reacted)\b/.test(normalized);
  if (rejectedContext) return false;

  return /\b(?:recommend(?:ed|ing)?|prescrib(?:e|ed|ing)|order(?:ed|ing)?|start(?:ed|ing)?|begin(?:ning)?|give|giving|administer(?:ed|ing)?|perform(?:ed|ing)?|proceed(?:ing)?(?: with)?|offer(?:ed|ing)?|will use|i'd like to|i plan to|i will|i(?:'m| am) going to|we plan to|we(?:'re| are) going to|we (?:need|should|will)|the plan is to|let's)\b/.test(normalized);
}

function case1ManagementEvidenceIsCompatible(content: string) {
  const normalized = content.toLowerCase().replace(/[’]/g, "'");
  const historicalQuestion = /^(?:have|has|had|did|were|was)\b.*\b(?:ever|before|previously|history|prior|past)\b/.test(normalized)
    || /\b(?:history of|in the past|previously|prior)\b/.test(normalized);
  if (historicalQuestion) return false;

  return /\b(?:admit|admitted|admitting|admission|hospitali[sz](?:e|ed|ation)|stay in (?:the )?hospital)\b/.test(normalized)
    || /\b(?:surgery|surgical|operative|operation|operate|omfs|oral surgeon|oral surgery)\b/.test(normalized)
    || /\b(?:extract|extracted|extracting|extraction)\b/.test(normalized)
    || /\bpull(?:ed|ing)? (?:out )?(?:the |this |that |your )?(?:bad )?tooth\b/.test(normalized)
    || /\b(?:remove|removing) (?:the |this |that |your )?(?:bad )?tooth\b|\bremoval of (?:the |this |that |your )?(?:bad )?tooth\b/.test(normalized);
}

function case2AntibioticPlanEvidenceIsCompatible(content: string) {
  const normalized = content.toLowerCase().replace(/[’]/g, "'");
  const antibioticReference = /\b(?:antibiotics?|antimicrobial (?:treatment|therapy)|unasyn|ampicillin[ -]sulbactam|clindamycin)\b/;
  if (!antibioticReference.test(normalized)) return false;

  const historyOrPriorUse = /\b(?:history of|in the past|previously|prior)\b.{0,60}\b(?:antibiotics?|antimicrobial|unasyn|ampicillin[ -]sulbactam|clindamycin)\b/.test(normalized)
    || /^(?:have|has|had|did|were|was)\b.{0,100}\b(?:antibiotics?|antimicrobial|unasyn|ampicillin[ -]sulbactam|clindamycin)\b.{0,30}\b(?:ever|before|previously|prior|past)\b/.test(normalized);
  const allergyInquiry = /\b(?:allerg(?:y|ic|ies)|reaction|reacted)\b.{0,60}\b(?:antibiotics?|antimicrobial|unasyn|ampicillin[ -]sulbactam|clindamycin)\b/.test(normalized)
    || /\b(?:antibiotics?|antimicrobial|unasyn|ampicillin[ -]sulbactam|clindamycin)\b.{0,60}\b(?:allerg(?:y|ic|ies)|reaction|reacted)\b/.test(normalized);
  const hypothetical = /\b(?:if|would|could|might|maybe|possibly|hypothetical(?:ly)?)\b.{0,80}\b(?:antibiotics?|antimicrobial|unasyn|ampicillin[ -]sulbactam|clindamycin)\b/.test(normalized);
  const negated = /\b(?:no|not|won't|will not|do not|don't|without)\b.{0,50}\b(?:recommend|start|begin|give|administer|order|prescribe|use|need)?\w*\b.{0,30}\b(?:antibiotics?|antimicrobial|unasyn|ampicillin[ -]sulbactam|clindamycin)\b/.test(normalized)
    || /\b(?:antibiotics?|antimicrobial|unasyn|ampicillin[ -]sulbactam|clindamycin)\b.{0,50}\b(?:not indicated|not recommended|unnecessary|won't be given|will not be given)\b/.test(normalized);
  if (historyOrPriorUse || allergyInquiry || hypothetical || negated) return false;

  return /\b(?:recommend(?:ed|ing)?|start(?:ed|ing)?|begin(?:ning)?|give|giving|administer(?:ed|ing)?|order(?:ed|ing)?|prescrib(?:e|ed|ing)|need|will use)\b/.test(normalized)
    || /\bthis antibiotic\b.{0,30}\bwill\b/.test(normalized);
}

function case3DrainageProposalEvidenceIsCompatible(content: string) {
  const normalized = content.toLowerCase().replace(/[’]/g, "'");
  const drainageReference = /\b(?:incision and drainage|i\s*(?:&|and)\s*d)\b|\b(?:drain|drainage|draining)\b.{0,55}\b(?:abscess|infection|pus|pressure)\b|\b(?:abscess|infection|pus|pressure)\b.{0,55}\b(?:drain|drainage|draining)\b/;
  if (!drainageReference.test(normalized)) return false;

  const negatedOrDeclined = /\b(?:no|not|won't|will not|do not|don't|decline(?:d|s)?|refus(?:e|ed|es)|without)\b.{0,70}\b(?:incision|drain|drainage|i\s*(?:&|and)\s*d)\b/.test(normalized)
    || /\b(?:incision|drain|drainage|i\s*(?:&|and)\s*d)\b.{0,70}\b(?:not indicated|not recommended|unnecessary|declined|refused|won't|will not)\b/.test(normalized);
  const hypotheticalOrDeferred = /\b(?:may|might|could|possibly|perhaps|consider|hypothetical(?:ly)?|later|eventually|in the future)\b.{0,80}\b(?:incision|drain|drainage|i\s*(?:&|and)\s*d)\b/.test(normalized)
    || /\bif\b.{0,100}\b(?:incision|drain|drainage|i\s*(?:&|and)\s*d)\b/.test(normalized);
  const historical = /\b(?:have you ever|did you ever|previously|in the past|history of)\b.{0,90}\b(?:incision|drain|drainage|drained|i\s*(?:&|and)\s*d)\b/.test(normalized)
    || /\b(?:incision|drain|drainage|drained|i\s*(?:&|and)\s*d)\b.{0,60}\b(?:before|previously|in the past|history|yesterday|earlier|last (?:week|month|year))\b/.test(normalized)
    || /\b(?:performed|completed|did)\b.{0,50}\b(?:incision|drainage|i\s*(?:&|and)\s*d)\b/.test(normalized);
  if (negatedOrDeclined || hypotheticalOrDeferred || historical) return false;

  return /\b(?:i'd like to|i recommend|i propose|i offer|i plan to|i will|i(?:'m| am) going to|we plan to|we(?:'re| are) going to|we (?:need|should|can|will)|the plan is to|let's|perform|proceed with|do)\b/.test(normalized);
}

function case3DrainageAgreementEvidenceIsCompatible(
  citedEvidence: readonly PatientQuestionEvidenceAlias[],
  allEvidence: readonly PatientQuestionEvidenceAlias[],
) {
  const citedAliases = new Set(citedEvidence.map((entry) => entry.alias));
  const validProposalIndexes = allEvidence.flatMap((entry, index) =>
    entry.role === "student" &&
    citedAliases.has(entry.alias) &&
    case3DrainageProposalEvidenceIsCompatible(entry.content)
      ? [index]
      : [],
  );
  if (validProposalIndexes.length === 0) return false;

  return allEvidence.some((entry, patientIndex) => {
    if (entry.role !== "patient" || !citedAliases.has(entry.alias)) return false;
    const normalized = entry.content.toLowerCase().replace(/[’]/g, "'").trim();
    if (/\b(?:ct|imaging|x-?ray|scan|antibiotics?|anesthe(?:sia|tic)|nerve block|referral|dentist)\b/.test(normalized)) {
      return false;
    }
    const earlierProposal = validProposalIndexes.some((index) => index < patientIndex);
    if (!earlierProposal) return false;

    const explicitlyAgreesToDrainage = /\b(?:agree|consent|okay|ok|fine|alright|go ahead|proceed|do it|let's do it|yes)\b.{0,60}\b(?:incision|drain|drainage|i\s*(?:&|and)\s*d)\b/.test(normalized)
      || /\b(?:incision|drain|drainage|i\s*(?:&|and)\s*d)\b.{0,60}\b(?:agree|consent|okay|ok|fine|alright|go ahead|proceed|do it|yes)\b/.test(normalized);
    if (explicitlyAgreesToDrainage) return true;

    const genericAgreement = /^(?:yes(?:,? (?:that's|that is))? (?:okay|ok|fine)|yes,? i (?:agree|consent)|okay|ok|alright|that's fine|that is fine|i agree|i consent|go ahead|let's do it|we can proceed)(?:[,.!]|$)/.test(normalized);
    if (!genericAgreement) return false;

    const immediatelyPrevious = allEvidence[patientIndex - 1];
    if (!immediatelyPrevious || immediatelyPrevious.role !== "student" || !citedAliases.has(immediatelyPrevious.alias)) {
      return false;
    }
    if (case3DrainageProposalEvidenceIsCompatible(immediatelyPrevious.content)) return true;
    const consentBridge = /\b(?:is that (?:okay|ok|fine)|do you agree|do i have your consent|can we proceed|may we proceed|are you (?:okay|ok|comfortable) with (?:that|this|proceeding))\b/i.test(immediatelyPrevious.content);
    return consentBridge && validProposalIndexes.some((index) => index < patientIndex - 1);
  });
}

function getSafeMetadata(
  parsed: Record<string, unknown>,
  text: string,
) {
  const events = isRecord(parsed.events) ? parsed.events : {};
  return {
    ...(typeof parsed.confidence === "number"
      ? { confidence: parsed.confidence }
      : {}),
    assertedEventNames: Object.keys(events).filter(
      (event) => events[event] === true,
    ),
    evidenceAliases: Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((alias): alias is string => typeof alias === "string")
      : [],
    evidenceAliasesValid: undefined,
    rawOutputLength: text.length,
  };
}

function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
