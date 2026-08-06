import { validateFactPreservation } from "./factPreservation";
import { renderAmaraCandidate, selectAmaraToneMode } from "./amaraRenderer";
import { AMARA_PATIENT_ID } from "./amaraContract";
import { renderStagedPatientCandidate } from "./stages";
import type {
  BehavioralRenderInput,
  BehavioralRenderResult,
} from "./types";

export type BehavioralCandidateRenderer = (
  input: Readonly<BehavioralRenderInput>,
) => string;

export function renderPatientBehavior(
  input: BehavioralRenderInput,
  candidateRenderer?: BehavioralCandidateRenderer,
): BehavioralRenderResult {
  const bypassReason = getBypassReason(input);
  if (bypassReason) {
    return {
      text: input.originalText,
      candidateText: input.originalText,
      preservedFactIds: input.governedFacts.map((fact) => fact.id),
      valid: true,
      violations: [],
      usedFallback: false,
      bypassReason,
      repetition: input.repetition,
      stage: input.stage,
    };
  }

  const toneMode = input.patientId === AMARA_PATIENT_ID ? selectAmaraToneMode(input) : undefined;
  let candidateText: string;
  try {
    candidateText = candidateRenderer
      ? candidateRenderer(input)
      : input.stage
        ? renderStagedPatientCandidate(input)
        : renderAmaraCandidate(input, toneMode);
  } catch {
    return fallback(input, input.originalText, toneMode, [{
      code: "unsupported-addition",
      message: "Behavioral rendering failed; authoritative text was retained.",
    }]);
  }

  const validation = validateFactPreservation({
    originalText: input.originalText,
    candidateText,
    governedFacts: input.governedFacts,
  });
  if (!validation.valid) return fallback(input, candidateText, toneMode, validation.violations);

  return {
    text: candidateText,
    candidateText,
    toneMode,
    preservedFactIds: validation.preservedFactIds,
    valid: true,
    violations: [],
    usedFallback: false,
    repetition: input.repetition,
    stage: input.stage,
  };
}

function fallback(
  input: BehavioralRenderInput,
  candidateText: string,
  toneMode: BehavioralRenderResult["toneMode"],
  violations: BehavioralRenderResult["violations"],
): BehavioralRenderResult {
  return {
    text: input.originalText,
    candidateText,
    toneMode,
    preservedFactIds: input.governedFacts.map((fact) => fact.id),
    valid: false,
    violations,
    usedFallback: true,
    repetition: input.repetition,
    stage: input.stage,
  };
}

function getBypassReason(input: BehavioralRenderInput): BehavioralRenderResult["bypassReason"] {
  if (!input.stage && input.patientId !== AMARA_PATIENT_ID) return "non-amara";
  if (!input.stage && input.caseId !== "case-01") return "wrong-case";
  if (!input.originalText) return "empty";
  if (input.exactTextRequired) return "exact-output";
  return undefined;
}
