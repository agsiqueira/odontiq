# OdontIQ Cases 1–5 Remediation Release Review

Date: 2026-07-16  
Scope: cumulative Phases 1–7 working tree  
Recommendation: **Ready with faculty follow-up**

## 1. Executive summary

Cases 1–5 now match their faculty-reviewable canonical fixtures with zero parity mismatches and zero unreachable rubric-required fact families. Shared disclosure, structured examination display, rubric evidence modes, and report provenance are covered by focused and aggregate regression gates. No unrelated or suspicious working-tree change was identified. The remaining questions are explicitly non-blocking faculty calibration items and were not resolved by implementation assumptions.

## 2. Original audit findings

The accepted 2026-07-16 audit recorded 31 findings: 10 Critical, 12 High, 7 Medium, and 2 Low. `docs/case-spec-audit.md` remains the historical baseline; the remediation did not rewrite the original record.

## 3. Completed remediation phases

- Phase 1 established Word-derived typed canonical fixtures, parity/reachability validators, audit documentation, and runtime/report infrastructure.
- Phases 2–6 aligned Cases 1–5 respectively, including patient disclosure, structured examinations/diagnostics, rubrics, reports, and focused regressions.
- Phase 7 reviewed the cumulative diff, added a consolidated release gate, performed mutation testing, documented the safe modification workflow, and reran the complete validation inventory.

## 4. Final case-by-case status

| Case | Canonical scenario | Parity | Reachability | Stabilization result |
| --- | --- | ---: | ---: | --- |
| 1 | Ludwig's angina with impending airway compromise | 0 | 0 | No cross-case contamination; airway urgency remains explicit |
| 2 | Upper-right odontogenic abscess/cellulitis with systemic infection | 0 | 0 | Patient history, oral exam, labs, and CT remain separated |
| 3 | Right mandibular periapical abscess with ulcer/NSAID intolerance | 0 | 0 | Former diabetes/periodontal scenario removed; ibuprofen is not rewarded |
| 4 | Necrotic pulp with acute apical periodontitis | 0 | 0 | Historical/current cold separated; routine antibiotics not rewarded |
| 5 | Symptomatic irreversible pulpitis | 0 | 0 | Cold trigger/persistence separated; unsupported heat/radiation/pregnancy absent |

## 5. Shared architecture changes

- Typed canonical fixtures remain separate from production runtime data.
- Explicit structured patient facts take precedence over duplicate legacy HPI strings.
- Disclosure uses targeted intents and preserves independently reachable negative findings.
- Case-specific selectors remain only where clinically distinct questions would otherwise collapse: Case 3 medication/NSAID staging, Case 4 historical versus current cold and allergy reaction, and Case 5 cold trigger versus persistence plus chewing versus percussion.
- `clinical-findings` and `diagnostic-results` render as structured clinician-facing examinations alongside vital signs.
- The production conversation path consumes the same runtime case identity and patient-fact layer that the focused validators compare with legacy scripted responses.

## 6. Rubric and evidence-model changes

Criterion IDs are globally unique, required weights are positive, neutral weights are zero, and faculty-review notes remain non-blocking. Opening an examination is represented by a viewing criterion; all additional examination recognition criteria use `clinical-statement` evidence and require learner-authored recognition. Diagnostic interpretation similarly requires learner evidence. Unsafe or unsupported rewards are excluded for Case 3 ibuprofen, Case 4 routine antibiotics, and Case 5 heat/radiation/pregnancy.

## 7. Validation inventory

Release validation covers five focused case scripts, the Case 5 cold regression, canonical parity in report and strict modes, reachability in report and strict modes, the combined case-spec command, rubric/scoring/semantic-evidence/report validators, canonical report generation, canonical faculty PDF output, patient dialogue/intent behavior, encounter persistence/synchronization, dashboards, lint, typecheck, production build, and diff whitespace checks. `validate:case-release-readiness` consolidates cross-case contamination, identity, examination isolation, rubric, and evidence-mode invariants.

## 8. Mutation-test results

All mutations were temporary and restored immediately:

1. Case 5 age changed from 32 to 33: strict canonical validation failed with one explicit age mismatch.
2. Case 5 tooth-saving goal made unreachable: strict reachability validation failed on `c5.goal`.
3. Unsupported Case 5 hot worsening reintroduced: strict canonical validation failed on canonical fact `c5.no-hot`.

Post-restoration strict validation returned to zero findings. Existing rubric/report tests cover viewer-only recognition and expected-versus-obtained provenance failure conditions.

The complete sweep also exposed one stale test assumption in `validatePostSemanticMergeRetry.ts`: it hard-coded the pre-remediation Case 1 rubric counts. The validator now derives supported and semantic criterion counts from the rubric and creates eight-item batches dynamically. The corrected test passes without changing runtime clinical behavior.

## 9. Remaining faculty-review questions

- Case 1: exact IV broad-spectrum antibiotic wording and whether CT contrast wording should be scored; imaging must not delay airway management.
- Case 2: whether lingering cold pain is historical only or should remain currently answerable.
- Case 3: safe acetaminophen dose, interval, and maximum daily amount.
- Case 4: delayed-antibiotic prescription language; it remains unscored.
- Case 5: exact local-anesthetic formulation calibration and whether it is scored or supporting context.

## 10. Known limitations

- Scripted legacy responses are deterministic while production patient prose is provider-generated from allowed facts; semantic wording may differ, but the fact boundary is shared and validated.
- Several rubric weights remain provisional pending faculty calibration.
- Word files are binary source artifacts; typed fixtures provide reviewable anchors but must be updated only after source or faculty decisions.
- Report-mode validators intentionally exit successfully when displaying debt; strict modes are the release gates.

## 11. Full changed-file inventory

### Canonical fixture infrastructure

- `src/data/canonicalCaseSpecs/case-01.ts` through `case-05.ts`
- `src/data/canonicalCaseSpecs/helpers.ts`, `index.ts`, and `schema.ts`
- the five Word specifications under `docs/faculty-specifications/`, from `case-01-ludwigs.docx` through `case-05-irreversible-pulpitis.docx`

### Case remediation

- `src/data/cases/case-01/case.json` through `case-05/case.json`

### Shared disclosure, examination, and diagnostic infrastructure

- `src/lib/patientDisclosure.ts`
- `src/lib/conversationEngine.ts`
- `src/data/cases/index.ts`
- `src/lib/cases.ts`
- `src/components/EncounterExperience.tsx`

### Rubric and report changes

- `src/lib/facultyRubric/caseRubrics.ts`
- `src/app/api/report/route.ts`
- `scripts/validateFacultyRubrics.mjs`
- `scripts/validateCanonicalReportGeneration.ts`

### Validation and documentation

- `package.json`
- `validation/canonicalCases/questions.ts`
- `scripts/validateCanonicalCases.ts`
- `scripts/validateCaseReachability.ts`
- `scripts/validateCase01Ludwigs.ts` through `validateCase04NecroticPulp.ts`
- `scripts/validateCase05LingeringCold.ts`
- `scripts/validateCase05IrreversiblePulpitis.ts`
- `scripts/validateCaseReleaseReadiness.ts`
- `docs/case-spec-audit.md`
- `docs/canonical-case-validation.md`
- `docs/case-remediation-release-review.md`

No changed file was categorized as unrelated or suspicious.

## 12. Recommended commit grouping

Use one branch with three reviewable commits and one pull request:

1. `feat(cases): add canonical case specification infrastructure`
2. `fix(cases): align cases 1-5 with canonical clinical specifications`
3. `test(cases): add remediation validation and release documentation`

This keeps canonical anchors, runtime remediation, and verification reviewable while preserving a buildable repository after each commit.

## 13. Recommended commit message

`fix(cases): align cases 1-5 with canonical specifications`

## 14. Recommended pull request

Title: `Align OdontIQ Cases 1–5 with canonical faculty specifications`

Description: Aligns runtime case data, disclosure, structured examinations/diagnostics, rubrics, and reports with Word-derived canonical fixtures. Adds focused and aggregate validation, provenance safeguards, mutation-tested release invariants, and preserves unresolved clinical questions for faculty review. All five cases finish with zero parity mismatches and zero reachability issues.

## 15. Release recommendation

**Ready with faculty follow-up.** The implementation is technically release-ready, and remaining questions are documented calibration matters rather than runtime blockers.

