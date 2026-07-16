# Faculty Case Specifications

These Word documents are the original faculty-authored clinical specifications for OdontIQ Cases 1–5.

They are the human-readable source of truth used to derive:

1. Canonical fixtures under `src/data/canonicalCaseSpecs/`
2. Runtime case data under `src/data/cases/`
3. Patient disclosure behavior
4. Examination and diagnostic findings
5. Faculty rubrics
6. Reports
7. Validation tests

## Safe case-update workflow

1. Confirm or update the faculty specification.
2. Update the corresponding canonical fixture.
3. Update the runtime case data.
4. Align disclosure prerequisites.
5. Align examination and diagnostic findings.
6. Align faculty rubrics.
7. Align report mappings.
8. Add or update the focused case validator.
9. Run `npm run validate:case-specs`.
10. Run both strict aggregate validators.
11. Obtain faculty approval for unresolved clinical questions.

Canonical fixtures must not be weakened merely to make runtime behavior pass.
