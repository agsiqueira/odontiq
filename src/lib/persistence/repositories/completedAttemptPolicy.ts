export function shouldPreserveValidCompletedAttempt(input: {
  generationStatus?: string;
  integrityStatus?: string;
  hasEvaluation: boolean;
  hasScore: boolean;
  hasReport: boolean;
}) {
  return (
    input.generationStatus === "COMPLETE" &&
    input.integrityStatus === "VALID" &&
    input.hasEvaluation &&
    input.hasScore &&
    input.hasReport
  );
}

export function selectRetainedAttemptIds(
  currentAttemptId: string,
  newestAttemptIds: readonly string[],
  limit = 10,
) {
  return [
    currentAttemptId,
    ...newestAttemptIds.filter((id) => id !== currentAttemptId),
  ].slice(0, limit);
}
