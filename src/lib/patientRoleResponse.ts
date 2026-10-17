import { normalizePatientDialogueWithDiagnostics } from "./patientDialogue";
import {
  assessPatientRole,
  SAFE_PATIENT_BASE_RESPONSE_FALLBACK,
  SAFE_PATIENT_ROLE_FALLBACK,
} from "./patientRoleGuard";
import { assessPatientOutputIntegrity } from "./patientOutputGuard";
import type { PatientDisclosureFact } from "./patientDisclosure";

export type PatientRoleSafeResponse = {
  text: string;
  formattingChanged: boolean;
  initialRejection?: string;
  repeatedDrift: boolean;
};

export async function generatePatientRoleSafeResponse({
  initialOutput,
  retry,
  visibleFacts = [],
  priorPatientDialogue = [],
  fallbackText,
  requiredFacts = [],
  allowPatientInitiatedQuestion = true,
  validateAdditional,
}: {
  initialOutput: string;
  retry: () => Promise<string>;
  visibleFacts?: readonly PatientDisclosureFact[];
  priorPatientDialogue?: readonly string[];
  fallbackText?: string;
  requiredFacts?: readonly PatientDisclosureFact[];
  allowPatientInitiatedQuestion?: boolean;
  validateAdditional?: (text: string) => { valid: boolean; reason?: string };
}): Promise<PatientRoleSafeResponse> {
  const prepare = (output: string) => {
    const normalized = normalizePatientDialogueWithDiagnostics(output);
    if (!allowPatientInitiatedQuestion && requiredFacts.length > 0 && containsUnsolicitedQuestion(normalized.text)) {
      const statements = normalized.text.split(/(?<=[.!?])\s+/)
        .filter(sentence => !sentence.includes("?")).join(" ").trim();
      // Keep a known factual answer only after independently validating it.
      // Approved patient questions are assembled by the state machine later.
      if (assessPatientRole(statements).valid
        && assessPatientOutputIntegrity(statements, visibleFacts, priorPatientDialogue, requiredFacts).valid) {
        return { ...normalized, text: statements, changed: true };
      }
    }
    return normalized;
  };
  let normalized = prepare(initialOutput);
  const assessment = assessPatientRole(normalized.text);
  const integrity = assessPatientOutputIntegrity(
    normalized.text,
    visibleFacts,
    priorPatientDialogue,
    requiredFacts,
  );
  const questionValid = allowPatientInitiatedQuestion || !containsUnsolicitedQuestion(normalized.text);
  const additional = validateAdditional?.(normalized.text);
  if (assessment.valid && integrity.valid && questionValid && additional?.valid !== false) {
    return {
      text: normalized.text,
      formattingChanged: normalized.changed,
      repeatedDrift: false,
    };
  }

  normalized = prepare(await retry());
  if (
    assessPatientRole(normalized.text).valid &&
    assessPatientOutputIntegrity(
      normalized.text,
      visibleFacts,
      priorPatientDialogue,
      requiredFacts,
    ).valid &&
    (allowPatientInitiatedQuestion || !containsUnsolicitedQuestion(normalized.text)) && validateAdditional?.(normalized.text)?.valid !== false
  ) {
    return {
      text: normalized.text,
      formattingChanged: normalized.changed,
      initialRejection: assessment.matchedPattern ?? integrity.reason ?? additional?.reason,
      repeatedDrift: false,
    };
  }

  return {
    text: fallbackText ?? (allowPatientInitiatedQuestion
      ? SAFE_PATIENT_ROLE_FALLBACK
      : SAFE_PATIENT_BASE_RESPONSE_FALLBACK),
    formattingChanged: false,
    initialRejection: assessment.matchedPattern ?? integrity.reason ?? additional?.reason ?? (!questionValid ? "unapproved patient question" : undefined),
    repeatedDrift: true,
  };
}

function containsUnsolicitedQuestion(text: string) {
  return /(?:^|[.!]\s+)[^?]*\?/m.test(text.trim());
}
