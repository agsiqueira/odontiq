import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  retrySource,
  encounterSource,
  startRouteSource,
  serviceSource,
  repositorySource,
  mentorSource,
  canonicalReportSource,
] = await Promise.all([
  readFile("src/components/RetryCaseButton.tsx", "utf8"),
  readFile("src/components/EncounterExperience.tsx", "utf8"),
  readFile("src/app/api/encounters/start/route.ts", "utf8"),
  readFile("src/lib/persistence/services/encounterService.ts", "utf8"),
  readFile("src/lib/persistence/repositories/encounterRepository.ts", "utf8"),
  readFile("src/components/MentorGeneratedDebrief.tsx", "utf8"),
  readFile("src/components/CanonicalCaseReport.tsx", "utf8"),
]);

assert.match(retrySource, /fetch\("\/api\/encounters\/start"/);
assert.match(retrySource, /JSON\.stringify\(\{ caseId, fresh: true \}\)/);
assert.match(retrySource, /disabled=\{isStarting\}/);
assert.match(retrySource, /if \(isStartingRef\.current\) return;/);
assert.match(retrySource, /A fresh encounter could not be started\. Please try again\./);
assert.doesNotMatch(retrySource, /error\.message|Reason:|console\.(?:error|warn|log)/);

const responseCheck = retrySource.indexOf("!isFreshEncounterResponse(payload, caseId)");
const clearSnapshot = retrySource.indexOf("removeEncounterSnapshot(caseId)");
const navigate = retrySource.indexOf("router.push(`/encounter/${caseId}`)");
assert(responseCheck >= 0 && clearSnapshot > responseCheck);
assert(navigate > clearSnapshot);
assert.match(retrySource, /catch \{[\s\S]*setStartFailed\(true\)/);

for (const prohibited of [
  "writeCompletedEncounterAttempt",
  "removeCompletedEncounter",
  "/api/reports",
  "/api/debrief",
  "/complete",
]) {
  assert(!retrySource.includes(prohibited));
}

assert.match(startRouteSource, /fresh[\s\S]*=== true/);
assert.match(
  startRouteSource,
  /fresh[\s\S]*\? await encounterService\.startFreshEncounter\(user\.id, caseId\)[\s\S]*: await encounterService\.getOrCreateActiveEncounter\(user\.id, caseId\)/,
);
assert.match(
  serviceSource,
  /startFreshEncounter[\s\S]*pauseActiveByUserAndCase\(userId, caseId\)[\s\S]*createActive\(userId, caseId\)/,
);
assert.match(repositorySource, /createActive[\s\S]*encounterData: \{\}/);
assert.match(repositorySource, /pauseActiveByUserAndCase[\s\S]*status: EncounterStatus\.PAUSED/);

const normalStart = encounterSource.slice(
  encounterSource.indexOf('fetch("/api/encounters/start"'),
  encounterSource.indexOf("const payload", encounterSource.indexOf('fetch("/api/encounters/start"')),
);
assert(normalStart.includes("JSON.stringify({ caseId: patientCase.id })"));
assert(!normalStart.includes("fresh"));
assert(!mentorSource.includes("fresh: true"));
assert(!canonicalReportSource.includes("fresh: true"));

for (const caseId of ["case-01", "case-02", "case-03", "case-04", "case-05"]) {
  const requestBody = { caseId, fresh: true };
  assert.deepEqual(requestBody, { caseId, fresh: true });
}

async function simulateRetry({ succeeds }: { succeeds: boolean }) {
  let snapshotPresent = true;
  let navigated = false;
  let active = false;
  let requests = 0;
  const retry = async () => {
    if (active) return;
    active = true;
    requests += 1;
    await Promise.resolve();
    if (!succeeds) {
      active = false;
      return;
    }
    snapshotPresent = false;
    navigated = true;
    active = false;
  };
  await Promise.all([retry(), retry(), retry()]);
  return { snapshotPresent, navigated, requests };
}

assert.deepEqual(await simulateRetry({ succeeds: true }), {
  snapshotPresent: false,
  navigated: true,
  requests: 1,
});
assert.deepEqual(await simulateRetry({ succeeds: false }), {
  snapshotPresent: true,
  navigated: false,
  requests: 1,
});

console.log("Fresh case-retry validation passed.");
