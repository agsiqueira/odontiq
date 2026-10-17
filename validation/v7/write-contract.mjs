import fs from 'node:fs';
const text=`# V7 behavioral contract and prior-evidence audit

Application base 1b0ae9c5396c60c7a55b1e1b549db81da9d01de7; evidence-only parent 0e36f5f1c52f06a62b1a97b6aab853c48473b616. git diff excluding validation is empty. All 370 V6 tested file hashes restored byte-for-byte before edits. Historical V4/V5/V6 evidence is immutable.

Authority: docs/faculty-specifications/README.md designates the five faculty Word files as clinical source of truth. Their document paragraphs and comments were extracted and inspected. The application catalog, prompt event definitions and state machine are the more specific existing executable timing contract. They are not equivalent authorities: conflicts are recorded below, not silently attributed to faculty.

Case 1: faculty allows an antibiotics/discharge request without an explicit timing condition and places the extraction question after admission/surgical management. Catalog implements only extraction after current admission/surgery/OMFS, once.
Case 2: faculty places antibiotic-effect question after antibiotic therapy. Application requires current antibiotic recommendation, not history/allergy/hypothetical/negation, once.
Case 3 CONFLICT: faculty places follow-up question after drainage proposal and agreement, then Why if provider says no to not needing dental care. Application permits follow-up after any active temporary treatment (antibiotic/block/drainage/acetaminophen), and Why after confirming prompt dental follow-up unless both temporary and definitive explanations were given. V7 preserves the existing executable rule; no clinical source is edited or new timing rule invented. Faculty clarification remains appropriate.
Case 4 MISSING FACULTY TIMING: faculty does not explicitly prescribe the catalog antibiotic-needed question. Existing application permits it on a current provider-given pain-treatment or disposition/follow-up plan, unless antibiotics are already recommended or explained unnecessary, once. Background screening, affordability, county selection, an offer to look for options, history and hypothetical questions are not a given plan. V7 enforces this existing rule rather than inventing a new faculty rule.
Case 5: faculty allows antibiotic request but no exact sequence. Existing application requires a substantive patient current-pain attribute (location, quality, severity, timing, trigger/relief or functional effect); generic pain alone is insufficient. An opening complaint may satisfy this just as a later answer may. No turn threshold. Once only.

Opening complaint is a patient report in response to the main-concern prompt; answering the clinician supplies the requested facts; a patient-initiated question seeks new information and requires a catalog prerequisite. Direct clinician prompts do not independently establish a prerequisite: answering them may establish one (e.g. a substantive pain description). A thank-you alone receives acknowledgment and does not reopen a question. Mixed thanks and a real clinical prompt remains answerable. Retry/fallback output is subject to the same conditions. Ineligible questions must be withheld without dropping the relevant answer; failed classification must not mark a question emitted, so later eligible turns can ask it.

Rubric across V5/V6/V7: assess exact final response plus every setup, authoritative facts, completeness, relevance including the above timing, and leakage. PASS requires all; FAIL for a concrete violation; REVIEW for unresolved scope/expectation ambiguity; ERROR/BLOCKED separate. HTTP and keyword success are not semantic passes. Original results and corrected verdicts retained. Identical text cannot establish behavioral improvement.

All 91 V5 corrections parsed, with exact context/question/response; 90 timing errors (88 Case 4, 2 Case 5) retain their corrected FAIL under this contract. The provider-name ambiguity retains REVIEW. V5 corrected 448 PASS/95 FAIL/3 REVIEW, V6 456/88/2. All 51 V6 JSON/report artifacts were parsed/read and hash-manifested. V6 unresolved 90, setup 1 FAIL/1 REVIEW and production 3 FAIL are included in V7 repair scope. No regrading changes yet.

Speech: V6 automated playback completed; human audibility unverified. No relevant speech code change planned, so playback is not repeated.
`;
fs.writeFileSync('validation/v7/CONTRACT.md',text);
