import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { HomeProgressionService } from "../src/lib/persistence/services/homeProgressionService";
import {
  ReportAttemptNotFoundError,
  ReportsService,
} from "../src/lib/persistence/services/reportsService";

async function main() {
  const attempts = [
    {
      attemptId: "case-1-newest",
      caseId: "case-01",
      generationStatus: "COMPLETE",
      integrityStatus: "VALID",
      percentage: 90,
      passed: true,
      completedAt: new Date("2026-07-12T12:00:00.000Z"),
    },
    {
      attemptId: "case-1-older",
      caseId: "case-01",
      generationStatus: "FAILED",
      integrityStatus: "INVALID",
      percentage: null,
      passed: false,
      completedAt: new Date("2026-07-12T11:00:00.000Z"),
    },
    {
      attemptId: "case-2",
      caseId: "case-02",
      generationStatus: "COMPLETE",
      integrityStatus: "VALID",
      percentage: 88,
      passed: true,
      completedAt: new Date("2026-07-12T10:00:00.000Z"),
    },
  ];
  const reportRepository = {
    async listByUser() {
      return attempts;
    },
    async findOwnedByAttemptId(_userId: string, attemptId: string) {
      if (attemptId !== "case-1-newest") return null;
      return {
        ...attempts[0],
        encounter: {
          encounterData: {
            schemaVersion: 1,
            caseId: "case-01",
            encounterVersion: 1,
            messages: [
              {
                id: "student-1",
                role: "student",
                text: "What brings you in?",
                timestamp: "2026-07-12T11:59:00.000Z",
              },
              {
                id: "patient-1",
                role: "patient",
                text: "My tooth hurts.",
                timestamp: "2026-07-12T11:59:01.000Z",
              },
            ],
            examinations: [],
            lifecycleEvents: [],
            disclosedFacts: [],
            checklistCoverage: { itemIds: [], evidence: [] },
            timing: { activeDurationMs: 1, pausedDurationMs: 0 },
            createdAt: "2026-07-12T11:58:00.000Z",
            updatedAt: "2026-07-12T12:00:00.000Z",
          },
        },
        facultyEvaluation: { data: { status: "complete" } },
        facultyScore: { data: { percentage: 90 } },
        facultyReport: { data: { caseId: "case-01" } },
      };
    },
  };
  const reports = new ReportsService(reportRepository);
  const dashboard = await reports.getDashboard("user-1");
  assert.equal(dashboard.length, 2);
  assert.equal(
    dashboard.find((item) => item.caseId === "case-01")?.latestAttemptId,
    "case-1-newest",
  );
  assert.deepEqual(await reports.getReport("user-1", "case-1-newest"), {
    evaluation: { status: "complete" },
    score: { percentage: 90 },
    report: { caseId: "case-01" },
    transcript: [
      {
        id: "student-1",
        role: "student",
        text: "What brings you in?",
        timestamp: "2026-07-12T11:59:00.000Z",
      },
      {
        id: "patient-1",
        role: "patient",
        text: "My tooth hurts.",
        timestamp: "2026-07-12T11:59:01.000Z",
      },
    ],
  });
  await assert.rejects(
    () => reports.getReport("user-2", "not-owned"),
    ReportAttemptNotFoundError,
  );

  const progression = new HomeProgressionService(
    { async listByUser() { return attempts; } },
    { async findActiveByUserAndCase() { return null; } },
    ["case-01", "case-02", "case-03", "case-04", "case-05"],
  );
  const next = await progression.getProgression("user-1");
  assert.deepEqual(next.completedCases, ["case-01", "case-02"]);
  assert.equal(next.currentStatus, "recommend");
  assert.equal(next.recommendedCase?.caseId, "case-03");

  const activeProgression = new HomeProgressionService(
    { async listByUser() { return attempts; } },
    {
      async findActiveByUserAndCase(_userId: string, caseId: string) {
        return caseId === "case-04"
          ? {
              id: "active-1",
              caseId,
              updatedAt: new Date("2026-07-12T13:00:00.000Z"),
            }
          : null;
      },
    },
    ["case-01", "case-02", "case-03", "case-04", "case-05"],
  );
  const activeResult = await activeProgression.getProgression("user-1");
  assert.equal(activeResult.currentStatus, "resume");
  assert.deepEqual(
    activeResult.activeEncounters.map((encounter) => encounter.caseId),
    ["case-04"],
  );

  const reportsPage = await readFile("src/app/reports/page.tsx", "utf8");
  const reportComponent = await readFile(
    "src/components/CanonicalCaseReport.tsx",
    "utf8",
  );
  const homeComponent = await readFile(
    "src/components/HomeProgressionCard.tsx",
    "utf8",
  );
  const casesComponent = await readFile(
    "src/components/CasesCarousel.tsx",
    "utf8",
  );
  assert(reportsPage.includes('fetch("/api/reports/dashboard")'));
  assert(reportsPage.includes("readCachedReportCards()"));
  assert(reportComponent.includes("/api/reports/${encodeURIComponent(attemptId)}"));
  assert(reportComponent.includes("readCompletedEncounterAttempt"));
  assert(homeComponent.includes('fetch("/api/home/progression")'));
  assert(casesComponent.includes('fetch("/api/home/progression")'));
  assert(casesComponent.includes('preferredAction: activeCaseIds.has(patientCase.id)'));
  assert(homeComponent.includes("getHomeProgression"));

  console.log("Server-backed dashboard validation passed.");
}

void main();
