const CONSENT_REQUEST_PATTERN =
  /\b(?:is that (?:okay|ok)|do you agree|are you (?:okay|ok|comfortable) with (?:that|this|proceeding)|are you comfortable proceeding|can we proceed|may we proceed|do I have your consent)\b/i;

const CURRENT_PROPOSAL_PATTERN =
  /\b(?:i(?:'|’)?d like to|i recommend|we (?:need|should|can|will)|i(?:'|’)?m going to|i am going to|the plan is to)\b/i;

const ABSCESS_CONTEXT_PATTERN = /\b(?:abscess|infection|pus|pressure)\b/i;
const DRAINAGE_ACTION_PATTERN =
  /\b(?:incision and drainage|i\s*(?:&|and)\s*d|drain(?:age|ing)?|allow (?:the )?(?:infection|pus) to drain|make (?:a )?(?:small )?(?:opening|incision))\b/i;
const EXPLANATION_PATTERN =
  /\b(?:drain|release|relieve|remove|let out|allow)\w*\b.{0,45}\b(?:infection|pus|pressure)\b|\b(?:infection|pus|pressure)\b.{0,45}\b(?:drain|release|relieve|remove|let out)\w*\b/i;
const TENTATIVE_OR_DEFERRED_PATTERN =
  /\b(?:may|might|could|possibly|perhaps|consider|later|eventually|in the future|if (?:it|things|the swelling)|depending on)\b/i;
const HISTORICAL_PATTERN =
  /\b(?:have you ever|did you ever|before|previously|in the past|had .{0,30}(?:drain|incision))\b/i;
const TREATMENT_SUBJECT_PATTERN =
  /\b(?:treatment|procedure|extract|extraction|remove the tooth|root canal|drain(?:age|ing)?|incision|numb|anesthesia|anaesthesia|antibiotic|imaging|x-?ray|admit|admission|surgery)\b/i;

export const CASE_3_CONSENT_RESPONSE = "Yes, that’s okay.";

export function isTreatmentConsentRequest(message: string): boolean {
  return CONSENT_REQUEST_PATTERN.test(message) &&
    CURRENT_PROPOSAL_PATTERN.test(message) &&
    TREATMENT_SUBJECT_PATTERN.test(message) &&
    !HISTORICAL_PATTERN.test(message);
}

export function case3ConsentResponse(caseId: string, message: string): string | undefined {
  if (caseId !== "case-03") return undefined;
  if (!isTreatmentConsentRequest(message)) return undefined;
  if (!ABSCESS_CONTEXT_PATTERN.test(message)) return undefined;
  if (!DRAINAGE_ACTION_PATTERN.test(message)) return undefined;
  if (!EXPLANATION_PATTERN.test(message)) return undefined;
  if (TENTATIVE_OR_DEFERRED_PATTERN.test(message)) return undefined;
  if (HISTORICAL_PATTERN.test(message)) return undefined;
  return CASE_3_CONSENT_RESPONSE;
}
