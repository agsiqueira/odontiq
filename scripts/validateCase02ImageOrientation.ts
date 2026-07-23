import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadCase } from "../src/data/cases";

const expectedReferences = new Map([
  ["case-01", ["/patients/case-01/examination/examination-01.jpg", "/patients/case-01/examination/examination-02.jpg"]],
  ["case-02", ["/patients/case-02/examination/examination-01-v2.png"]],
  ["case-03", ["/patients/case-03/examination/examination-01.jpg"]],
  ["case-04", ["/patients/case-04/examination/examination-01.png"]],
  ["case-05", ["/patients/case-05/examination/examination-01.jpg"]],
]);

for (const [caseId, expected] of expectedReferences) {
  const caseData = loadCase(caseId);
  assert(caseData, caseId);
  const actual = caseData.assets.examinations.flatMap((exam) => "image" in exam ? [exam.image] : []);
  assert.deepEqual(actual, expected, `${caseId} examination references changed unexpectedly`);
  for (const reference of actual) assert(existsSync(join(process.cwd(), "public", reference)), reference);
}

const correctedPath = join(process.cwd(), "public", "patients", "case-02", "examination", "examination-01-v2.png");
const corrected = readFileSync(correctedPath);
assert.equal(corrected.subarray(1, 4).toString("ascii"), "PNG");
assert.equal(corrected.readUInt32BE(16), 447);
assert.equal(corrected.readUInt32BE(20), 322);

// Protects the reviewer-approved, horizontally corrected Case 2 orientation.
assert.equal(createHash("sha256").update(corrected).digest("hex"), "da8cd04decd6d7da34607402b611e52f6b6af1cf9a306c8d8031c836ab523445");

const viewer = readFileSync(join(process.cwd(), "src", "components", "ZoomableExaminationImage.tsx"), "utf8");
assert(!/scaleX\s*\(\s*-1\s*\)|scale\s*\(\s*-1\s*[,)]/i.test(viewer), "The shared examination viewer must not mirror images");
assert.match(viewer, /scale\(\$\{zoom\}\)/, "Zoom must retain its positive-scale implementation");

console.log("Case 2 examination-image orientation validation passed (PNG 447x322, versioned reference, no viewer mirroring, other case references unchanged).");
