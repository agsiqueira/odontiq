import { validateFactPreservation } from "./factPreservation";
import type {
  BehavioralRenderInput,
  BehavioralRenderResult,
} from "./types";

export type BehavioralCandidateRenderer = (
  input: Readonly<BehavioralRenderInput>,
) => string;

export function renderPatientBehavior(
  input: BehavioralRenderInput,
  candidateRenderer: BehavioralCandidateRenderer = (renderInput) => renderInput.originalText,
): BehavioralRenderResult {
  let candidateText: string;
  try {
    candidateText = candidateRenderer(input);
  } catch {
    return fallback(input, [{
      code: "unsupported-addition",
      message: "Behavioral rendering failed; authoritative text was retained.",
    }]);
  }

  const validation = validateFactPreservation({
    originalText: input.originalText,
    candidateText,
    governedFacts: input.governedFacts,
  });
  if (!validation.valid) return fallback(input, validation.violations);

  return {
    text: candidateText,
    preservedFactIds: validation.preservedFactIds,
    valid: true,
    violations: [],
    usedFallback: false,
  };
}

function fallback(
  input: BehavioralRenderInput,
  violations: BehavioralRenderResult["violations"],
): BehavioralRenderResult {
  return {
    text: input.originalText,
    preservedFactIds: input.governedFacts.map((fact) => fact.id),
    valid: false,
    violations,
    usedFallback: true,
  };
}
