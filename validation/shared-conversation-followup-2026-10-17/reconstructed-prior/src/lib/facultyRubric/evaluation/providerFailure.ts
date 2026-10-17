export type SemanticProviderFailureCategory =
  | "timeout"
  | "network"
  | "authentication"
  | "rate_limit"
  | "endpoint"
  | "model"
  | "unknown";

const providerCategoryMap: Readonly<
  Record<string, SemanticProviderFailureCategory>
> = {
  timeout: "timeout",
  network: "network",
  authentication: "authentication",
  "rate-limit": "rate_limit",
  "endpoint-not-found": "endpoint",
  "model-not-found": "model",
};

export function classifySemanticProviderFailure(
  error: unknown,
): SemanticProviderFailureCategory {
  if (!error || typeof error !== "object" || !("category" in error)) {
    return "unknown";
  }

  const category = (error as { category?: unknown }).category;
  return typeof category === "string"
    ? providerCategoryMap[category] ?? "unknown"
    : "unknown";
}

export function buildSemanticProviderFailureToken(
  batchNumber: number,
  error: unknown,
) {
  const safeBatchNumber =
    Number.isSafeInteger(batchNumber) && batchNumber > 0 ? batchNumber : 1;
  return `semantic_batch_${safeBatchNumber}_request_failed_${classifySemanticProviderFailure(error)}`;
}

export function isSemanticProviderFailureToken(value: string) {
  return /^semantic_batch_\d+_request_failed(?:_(?:timeout|network|authentication|rate_limit|endpoint|model|unknown))?$/.test(
    value,
  );
}
