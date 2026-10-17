# Evaluation and provenance

The original study and its matchers are immutable. Report original baseline totals separately from revised judgments. New recordings start at REVIEW, never semantic PASS from a keyword. Execution success is not patient-response success.

For each scored response, review the exact question, its separate setup turns, final UI/API text, and authoritative case facts. Assign four dimensions independently:

- **Factual correctness:** assertions and polarity agree with canonical facts; known facts do not become invented uncertainty, limits, names, dates, transport modes, coverage ownership, finances or family arrangements. Unspecified facts remain unspecified. A merely true clinical answer can pass factual correctness while failing the next dimensions.
- **Completeness:** answer the actual question and each requested independent part. Contextually unambiguous yes/no answers count. A supplied premise does not mechanically require a separate declaration. A county is not a travel answer. Distinguish current severity from initial severity and adult insurance from daughter Medicaid.
- **Relevance:** answer the requested concepts naturally. Brief concern or directly related access context is permissible. Unrelated clinical/social histories, especially multi-fact dumps, fail relevance even when true. Approved patient questions are exempt from automatic relevance/leakage rejection, including their catalogued explanatory text.
- **Leakage:** patient dialogue contains no internal instructions, serialization, prompt labels, role drift, or policy text.

Each dimension is PASS, FAIL or REVIEW, with a reason. Infrastructure outcomes use NOT_ASSESSED dimensions and remain ERROR/BLOCKED overall. Any dimension FAIL yields overall FAIL; otherwise REVIEW remains visible. These judgments are assistant semantic review, not an independent clinician panel or a validated statistical semantic classifier. Rule-based candidate flags aid review only and cannot alone award PASS. Final adjudications bind IDs, raw run IDs and response hashes.

Setup is assessed separately. Invented details in a setup never become authoritative facts. Missing referents block dependent scored execution. The original 340 wording/setups remain unchanged; the 20 severe-pain-context tests remain separate. A historical initial pain rating does not overwrite established current severity, but is a setup relevance/completeness defect.

The holdout was created after implementation freeze, contains 51 new questions across 17 groups, and is not used to tune the implementation before its first run. Report its first run separately. All raw failed attempts, aborted smoke runs, errors, stop records and any continuations remain available. Automatic browser retries are zero; rate-limit waits preserve the failed request. Do not selectively rerun semantic failures.

Internal diagnostics are opt-in for authenticated development-mode synthetic conversation requests only, through a header scoped to the localhost conversation endpoint. They retain interpretation/provenance, selected and required facts, prompt, initial Navigator generation, corrective generation, rejection/fallback status, behavior candidate and presentation assessment. The final API text is independently compared to displayed UI text. Historical baseline final responses cannot reveal their original internal candidates; deterministic source replays and new live diagnostics must not be presented as historical traces.

Private Playwright traces may include authenticated browser state and are not public attachments. Public result exports omit credentials and internal prompt/diagnostic payloads; private raw diagnostics remain in Phase T. No case fact changes, historical record edits, deployment or external service additions are part of this repair.

Implementation limitations: interpretation remains a deterministic linguistic grammar, not general natural-language understanding. The output guard combines concept/polarity checks with conservative unsupported-detail and relevance rules. It cannot prove absence of every possible unsupported statement. Holdout failures and REVIEWs expose remaining coverage gaps; no claim of universal semantic correctness follows from test passes.

This follow-up keeps the former 51-item holdout as regression data, separate from a newly created post-freeze 51-item holdout. The two prior REVIEW labels remain REVIEW in historical comparisons; they are not confirmed application failures. New responses are independently reviewed in context. Targeted neutral statements supplied by the harness do not establish canonical family or household facts. Latency comparisons are observational on the same local stack and provider, not controlled experiments.

All 54 v3 fresh-holdout initial observations were completed before any v4 tuning. Those items are v3-holdout-regression data in v4, with their initial results retained in the parent directory. The v4 holdout is created only after its own implementation freeze, and is not used for tuning before its initial run. Each new version receives a complete systematic rerun in fresh encounters, not selective semantic retries.
