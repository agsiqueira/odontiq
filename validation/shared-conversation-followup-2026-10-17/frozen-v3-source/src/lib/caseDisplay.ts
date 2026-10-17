export function getCaseDisplayLabel(caseId: string) {
  const stableCaseNumber = Number(caseId.match(/\d+/)?.[0]);
  return Number.isFinite(stableCaseNumber) ? `Case ${stableCaseNumber}` : caseId;
}
