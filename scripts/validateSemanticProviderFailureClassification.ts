import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildSemanticProviderFailureToken,
  classifySemanticProviderFailure,
  isSemanticProviderFailureToken,
  type SemanticProviderFailureCategory,
} from "../src/lib/facultyRubric/evaluation/providerFailure";
import { evaluateFacultySemanticWithRetry } from "../src/lib/facultyRubric/evaluation/retry";

const categoryCases: Array<{
  providerCategory: string;
  expected: SemanticProviderFailureCategory;
}> = [
  { providerCategory: "timeout", expected: "timeout" },
  { providerCategory: "network", expected: "network" },
  { providerCategory: "authentication", expected: "authentication" },
  { providerCategory: "rate-limit", expected: "rate_limit" },
  { providerCategory: "endpoint-not-found", expected: "endpoint" },
  { providerCategory: "model-not-found", expected: "model" },
];

for (const { providerCategory, expected } of categoryCases) {
  const rawMessage = `sensitive-${providerCategory}-token-transcript-prompt-body-output`;
  const error = Object.assign(new Error(rawMessage), {
    category: providerCategory,
    credential: "secret-api-key",
  });
  assert.equal(classifySemanticProviderFailure(error), expected);
  assert.equal(
    buildSemanticProviderFailureToken(7, error),
    `semantic_batch_7_request_failed_${expected}`,
  );
}

const sensitiveValues = [
  "provider raw exception",
  "learner transcript",
  "system prompt",
  "request body",
  "provider output",
  "secret-api-key",
];
const unknownToken = buildSemanticProviderFailureToken(3, {
  category: "unrecognized-provider-category",
  message: sensitiveValues.join(" | "),
});
assert.equal(unknownToken, "semantic_batch_3_request_failed_unknown");
for (const sensitiveValue of sensitiveValues) {
  assert(!unknownToken.includes(sensitiveValue));
}
assert.equal(classifySemanticProviderFailure(new Error("timed out with secret")), "unknown");

assert(isSemanticProviderFailureToken("semantic_batch_1_request_failed"));
assert(isSemanticProviderFailureToken("semantic_batch_1_request_failed_timeout"));
assert(!isSemanticProviderFailureToken("semantic_batch_1_request_failed_secret-api-key"));

let providerCalls = 0;
let exhaustedToken = "";
try {
  await evaluateFacultySemanticWithRetry({
    evaluate: async () => {
      providerCalls += 1;
      const providerError = Object.assign(
        new Error("raw credential secret-api-key and transcript"),
        { category: "timeout" },
      );
      throw new Error(buildSemanticProviderFailureToken(1, providerError));
    },
  });
} catch (error) {
  exhaustedToken = error instanceof Error ? error.message : "";
}

assert.equal(providerCalls, 2, "Semantic provider failure must exhaust the existing retry.");
assert.equal(exhaustedToken, "semantic_batch_1_request_failed_timeout");
assert(!exhaustedToken.includes("secret-api-key"));
assert(!exhaustedToken.includes("transcript"));

const semanticSource = readFileSync(
  new URL("../src/lib/facultyRubric/evaluation/semantic.ts", import.meta.url),
  "utf8",
);
assert.match(
  semanticSource,
  /buildSemanticProviderFailureToken\(batchIndex \+ 1, error\)/,
  "Semantic request failures must use the bounded token builder with the current batch number.",
);
assert.doesNotMatch(
  semanticSource,
  /buildSemanticProviderFailureToken\(batchIndex \+ 1, error\)[\s\S]{0,80}cause:\s*error/,
  "Semantic request failures must not retain the raw provider error as a cause.",
);

const orchestratorSource = readFileSync(
  new URL("../src/lib/facultyRubric/evaluation/orchestrator.ts", import.meta.url),
  "utf8",
);
assert.match(
  orchestratorSource,
  /isSemanticProviderFailureToken\(error\.message\)/,
  "The persisted evaluation error must accept bounded and historical semantic provider tokens.",
);

console.log("Semantic provider failure-classification validation passed.");
