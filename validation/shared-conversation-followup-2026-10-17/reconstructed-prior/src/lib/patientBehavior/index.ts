export { AMARA_BEHAVIORAL_CONTRACT, AMARA_PATIENT_ID } from "./amaraContract";
export { attachGovernedFacts } from "./governedFacts";
export { renderPatientBehavior } from "./renderer";
export { renderAmaraCandidate, selectAmaraToneMode } from "./amaraRenderer";
export { buildAmaraBehaviorFixtures, buildAmaraRepetitionFixtures } from "./amaraFixtures";
export {
  buildAmaraRepetitionContext,
  classifyAmaraRepetitionSignal,
  hasCompleteAmaraRepetitionFacts,
  selectAmaraRepetitionFacts,
} from "./repetition";
export type { AmaraRepetitionSignal, PersistedBehaviorIntentTurn } from "./repetition";
export { validateFactPreservation } from "./factPreservation";
export {
  PATIENT_BEHAVIOR_PROFILES,
  behavioralContractForCase,
  behavioralStageForNextTurn,
  patientBehaviorProfileForCase,
  renderStagedPatientCandidate,
  renderStagedPatientCandidateResult,
  selectOptionalPersonalityPhrase,
  isBehavioralPhraseEligible,
  selectBehavioralStage,
} from "./stages";
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
  BehavioralIntentHistory,
  BehavioralRepetitionContext,
  BehavioralRepetitionLevel,
  BehavioralStage,
  GovernedPatientId,
  PatientBehaviorProfile,
  BehavioralPhrase,
  BehavioralPhraseCategory,
  BehavioralPhraseRisk,
  OptionalPhraseSelection,
  OptionalPhraseSuppressionReason,
} from "./types";
