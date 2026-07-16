# Canonical case validation

The fixtures in `src/data/canonicalCaseSpecs/` are faculty-reviewable, typed review artifacts for Cases 1–5. They represent the visible body text and comments from the five Word specifications listed in each fixture, using `docs/case-spec-audit.md` as the accepted extraction baseline.

They are deliberately separate from `src/data/cases/`: production does not import them, and they are not authoritative runtime data yet. They must not be silently edited merely to make the current implementation pass.

## Format and provenance

Each fixture records identity, source files, stable fact IDs, statements, categories, values, precision, polarity, patient knowledge, disclosure requirements, rubric relevance, and pending faculty confirmation. Source provenance distinguishes `word-body`, `word-comment`, `audit-interpretation`, and `implementation-metadata`; an audit interpretation is not equivalent to a direct Word statement. Names and gender are explicitly implementation metadata.

`not-specified` polarity/precision is distinct from a negative clinical finding. Unresolved questions remain in each fixture's `facultyReview` list with `status: "pending"`; no answer is inferred.

## Commands

- `npm run validate:canonical-cases` validates fixture shape and reports static parity findings, exiting successfully.
- `npm run validate:canonical-cases:strict` prints the same findings and exits nonzero when mismatches exist.
- `npm run validate:case-reachability` inventories deterministic disclosure reachability and exits successfully.
- `npm run validate:case-reachability:strict` exits nonzero for reachability findings.
- `npm run validate:case-specs` runs both report-mode validators.

Report mode is appropriate while known inconsistencies remain and is intentionally not part of the production build or CI. Strict mode is the remediation gate.

## Remediation workflow

When faculty approves a case correction, change the runtime case or rubric in its own remediation phase, then run strict validation. Update a canonical fixture only when the source record or an explicit faculty decision changes; record the correct provenance and preserve unresolved questions. Reachability fixes should make an appropriate deterministic question expose the supporting production fact without releasing it before its stated prerequisite.

## How to Safely Modify a Clinical Case

1. Update or confirm the faculty-owned Word specification.
2. Update the canonical fixture only when the source or an explicit faculty decision changes, preserving provenance and unresolved questions.
3. Update the runtime case data under `src/data/cases/`.
4. Update disclosure prerequisites and deterministic question handling without broadening unrelated disclosure.
5. Update structured examination and diagnostic findings, keeping clinician-only data out of patient facts.
6. Update rubric criteria and evidence modes; viewing material must not substitute for learner recognition.
7. Update canonical and legacy report mappings while keeping expected findings separate from obtained evidence.
8. Add or update a focused case regression, including unsupported-fact exclusions.
9. Run the focused validator plus both strict aggregate validators and the release-readiness gate.
10. Obtain and record faculty review for unresolved clinical ambiguity before changing canonical facts or scored requirements.

The Word files are the original clinical source, canonical fixtures are faculty-reviewable machine-readable anchors, and runtime JSON is the production implementation. Focused validators explain one case in detail; aggregate report mode inventories debt, while strict mode is the release gate. Never weaken a canonical fixture or matcher merely to make runtime behavior pass.
