import { normalizePatientDialogueWithDiagnostics } from "./patientDialogue";
import {
  assessPatientRole,
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
  fallbackText = SAFE_PATIENT_ROLE_FALLBACK,
  requiredFacts = [],
}: {
  initialOutput: string;
  retry: () => Promise<string>;
  visibleFacts?: readonly PatientDisclosureFact[];
  priorPatientDialogue?: readonly string[];
  fallbackText?: string;
  requiredFacts?: readonly PatientDisclosureFact[];
}): Promise<PatientRoleSafeResponse> {
  let normalized = normalizePatientDialogueWithDiagnostics(initialOutput);
  const assessment = assessPatientRole(normalized.text);
  const integrity = assessPatientOutputIntegrity(
    normalized.text,
    visibleFacts,
    priorPatientDialogue,
    requiredFacts,
  );
  if (assessment.valid && integrity.valid) {
    return {
      text: normalized.text,
      formattingChanged: normalized.changed,
      repeatedDrift: false,
    };
  }

  normalized = normalizePatientDialogueWithDiagnostics(await retry());
  if (
    assessPatientRole(normalized.text).valid &&
    assessPatientOutputIntegrity(
      normalized.text,
      visibleFacts,
      priorPatientDialogue,
      requiredFacts,
    ).valid
  ) {
    return {
      text: normalized.text,
      formattingChanged: normalized.changed,
      initialRejection: assessment.matchedPattern ?? integrity.reason,
      repeatedDrift: false,
    };
  }

  return {
    text: fallbackText,
    formattingChanged: false,
    initialRejection: assessment.matchedPattern ?? integrity.reason,
    repeatedDrift: true,
  };
}
