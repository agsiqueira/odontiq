import type { PatientDisclosureFact } from "./patientDisclosure";
import { assessPatientOutputIntegrity } from "./patientOutputGuard";
import { assessPatientRole } from "./patientRoleGuard";
import { assessBackgroundAnswer, type BackgroundTurn } from "./patientBackgroundTurn";
import { assessCanonicalAssertions } from "./patientCanonicalAssertions";

export type FinalResponseValidationContext = {
  backgroundTurn?: BackgroundTurn;
  visibleFacts?: readonly PatientDisclosureFact[];
  requiredFacts?: readonly PatientDisclosureFact[];
  priorPatientDialogue?: readonly string[];
  canonicalFacts?: readonly PatientDisclosureFact[];
  latestStudentMessage?: string;
};

export function validatePatientFinalResponse(text: string, context: FinalResponseValidationContext = {}) {
  const role = assessPatientRole(text);
  if (!role.valid) return { valid: false, reason: role.matchedPattern };
  const canonical = assessCanonicalAssertions(text, context.canonicalFacts ?? context.visibleFacts ?? [], context);
  if (!canonical.valid) return canonical;
  if (context.backgroundTurn) {
    const background = assessBackgroundAnswer(text, context.backgroundTurn);
    if (!background.valid) return background;
  }
  return assessPatientOutputIntegrity(text, context.visibleFacts ?? [], context.priorPatientDialogue ?? [], context.requiredFacts ?? []);
}

export function assertPatientFinalResponse(text: string, context: FinalResponseValidationContext = {}) {
  const result = validatePatientFinalResponse(text, context);
  if (!result.valid) throw new Error(`Final patient response rejected: ${result.reason ?? "invalid dialogue"}`);
}
