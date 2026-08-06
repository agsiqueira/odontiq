export { AMARA_BEHAVIORAL_CONTRACT, AMARA_PATIENT_ID } from "./amaraContract";
export { attachGovernedFacts } from "./governedFacts";
export { renderPatientBehavior } from "./renderer";
export { renderAmaraCandidate, selectAmaraToneMode } from "./amaraRenderer";
export { buildAmaraBehaviorFixtures } from "./amaraFixtures";
export { validateFactPreservation } from "./factPreservation";
export {
  IMMUTABLE_RESPONSE_ELEMENTS,
  MUTABLE_RESPONSE_ELEMENTS,
} from "./types";
export type {
  BehavioralContract,
  BehavioralRenderInput,
  BehavioralRenderResult,
  BehavioralViolation,
  GovernedFact,
  AmaraToneMode,
} from "./types";
