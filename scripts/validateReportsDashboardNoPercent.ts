import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const [
  dashboardSource,
  dashboardApiSource,
  reportsServiceSource,
  persistenceSource,
  learnerReportSource,
  facultyReportSource,
] = await Promise.all([
  readSource("src/app/reports/page.tsx"),
  readSource("src/app/api/reports/dashboard/route.ts"),
  readSource("src/lib/persistence/services/reportsService.ts"),
  readSource("src/lib/persistence/completedAttemptClient.ts"),
  readSource("src/components/LearnerCaseReport.tsx"),
  readSource("src/components/FacultyCaseReport.tsx"),
]);

for (const prohibited of [
  "card.score",
  "formatScore",
  "score?: number",
  "score: attempt.percentage",
  "score: summary.facultyRubricScore",
]) {
  assert(
    !dashboardSource.includes(prohibited),
    `reports dashboard exposes a card percentage through: ${prohibited}`,
  );
}
assert.doesNotMatch(dashboardSource, />\s*\{?[^<\n]*%[^<\n]*\}?\s*</);
assert.doesNotMatch(dashboardSource, /aria-(?:label|description)=.*(?:score|percent)/i);
assert.doesNotMatch(dashboardSource, /title=.*(?:score|percent)/i);
assert.doesNotMatch(dashboardSource, /justify-between[^"\n]*score|score[^"\n]*justify-between/i);

for (const preserved of [
  "View Report",
  "Completed",
  "Generating Report",
  "In Progress",
  "Report Interrupted",
  "Not Started",
  "card.patientCase.patientName",
  "card.patientCase.openingStatement",
  "formatCaseNumber(card.patientCase.id)",
  "Completed {formatCompletionDate(card.completedAt)}",
]) {
  assert(dashboardSource.includes(preserved), `reports dashboard lost: ${preserved}`);
}

assert.match(
  dashboardSource,
  /`\/reports\/\$\{card\.patientCase\.id\}\$\{attemptQuery\}`/,
);
assert.match(dashboardSource, /encodeURIComponent\(card\.attemptId \?\? ""\)/);
assert.match(dashboardSource, /\.sort\(compareReportCards\)/);
assert.match(dashboardSource, /statusDetails\[left\.status\]\.rank/);
assert.match(dashboardSource, /Date\.parse\(right\.completedAt/);
assert.match(dashboardSource, /CASES\.indexOf\(left\.patientCase\)/);

// Complete, pending/in-progress, failed, cached, and absent cases all flow into
// the same score-free ReportCaseCard presentation.
assert.match(dashboardSource, /cards\.map\(\(card\) => <ReportCaseCard/);
assert.match(dashboardSource, /attempt\.generationStatus === "COMPLETE"/);
assert.match(dashboardSource, /attempt\.generationStatus === "PENDING"/);
assert.match(dashboardSource, /attempt\.generationStatus === "IN_PROGRESS"/);
assert.match(dashboardSource, /status: "interrupted" as const/);
assert.match(dashboardSource, /cardFromCompletedSummary/);

// API contracts, persisted score artifacts, faculty scoring, and the Phase 3B
// individual learner-report score removal remain unchanged.
assert.match(dashboardSource, /percentage: number \| null/);
assert.match(dashboardApiSource, /getDashboard/);
assert.match(reportsServiceSource, /percentage: attempt\.percentage/);
assert.match(reportsServiceSource, /passed: attempt\.passed/);
assert.match(persistenceSource, /score: summary\.facultyRubricScore/);
assert.match(persistenceSource, /percentage: summary\.facultyRubricScore\?\.percentage/);
assert.match(facultyReportSource, /facultyReport\.overallScore\.percentage/);
assert.doesNotMatch(learnerReportSource, /Overall score|overallScore\.percentage/);

console.log("Reports dashboard no-percentage validation passed.");
