# Case 3 production follow-up investigation — 2026-10-18

## Finding
The original production smoke FAIL is retained. “Why?” was eligible and omitted; the clinician had not already answered it. No production application, configuration, data or deployment was changed during this investigation. No production reproduction requests were sent.

Production: merge `69a24fe9fb6d1121e67da8d2ce70cc02b574266c`, Render deployment `dep-dba5dmajnfac73ee9hkg`. A final read-only Render check confirmed this deployment remains live. Fix branch: `codex/case3-followup-evidence`, isolated worktree based on that exact merge.

## Exact exchange and persisted evidence
Encounter `f11436df-fe40-4569-8202-50edc554eba5`. All six exact questions/responses, request IDs and reviewed outcomes are in [original-conversation.json](original-conversation.json). Read-only database evidence is in [production-evidence.json](production-evidence.json).

Immediately preceding clinician turn: “You have an abscess. I recommend an I&D to drain the infection and relieve the pressure. Is that okay?”
Patient: “Yes, that’s okay. Even with this treatment, do I still need to see my dentist soon?”

Failing clinician turn: “Yes, you still need to see your dentist promptly.”
Actual final patient response: “Okay, I'll make sure to keep that appointment. Thank you.”
Request `case-03-1792301155660-5-response`, persisted at `2026-10-18T05:25:56.947Z`, state version 5, selected question null.

Earlier context: opening tooth pain; daughter Medicaid with unknown dental condition; own dentist and next-week appointment, unknown attendance frequency. Next clinician turn was a thank-you, answered “You're welcome.” None explained definitive treatment.

Exactly one question emission exists: `c3-follow-up-needed-question`. There is no Why emission, so it was neither previously consumed nor lost between API, UI and storage. Original release persistence verification matched displayed final text to stored final text. Lifecycle records contain student-message and patient-response events, not the accepted raw classifier output.

## Decision chain and evidence limits
Before the first follow-up question, classifier stage gating did not allow the three follow-up-answer events. The consent response advanced state to version 4. The failing confirmation advanced it to version 5 with all three flags true: `promptDentalFollowUpConfirmed`, `drainageTemporaryOrNondefinitiveExplained`, and `definitiveDentalTreatmentExplained`. Closure does not classify or advance this state. Thus those accepted flags are reconstructable from the ordered durable state transitions. The original raw classifier JSON, confidence and evidence aliases were not persisted and cannot be quoted or recovered from these records. Test confidence 0.99 is synthetic, not an asserted original value.

The state machine correctly suppresses Why when both explanation flags are true. They were unsupported here: current confirmation only instructed prompt follow-up; earlier drainage/pressure wording was from another turn, and no clinician turn established required definitive dental treatment. Existing shared eligibility validation did not check these Case 3 explanation claims. Final assembly correctly persisted the resulting acknowledgment with no question. Root cause is insufficient validation of current-turn explanation evidence, not transport, transaction loss, duplicate consumption or an incorrect smoke expectation. Whether the model borrowed the prior drainage statement or inferred an explanation cannot be established without raw output; the unsupported flags themselves are established.

User impact: the simulated patient misses the intended opportunity to elicit why dental follow-up is necessary. No patient fact fabrication or persistence loss is demonstrated by this failure. Why is not permanently consumed and can still become eligible on a later qualifying confirmation; that does not erase this omission.

## Authority and frozen comparison
[../v7/CONTRACT.md](../v7/CONTRACT.md) and [../v7/AUTHORITY.md](../v7/AUTHORITY.md) preserve the faculty/application conflict: faculty ties the first question to drainage agreement; the executable application permits broader temporary treatment. Both support the drainage sequence here. The existing executable Why rule requires prompt follow-up confirmation after the first question, unless the current provider answer supplies both explanations. Current-answer scope is specified in `src/lib/patientQuestions/prompt.ts`. This repair preserves those rules; faculty clarification of the broader temporary-treatment scope remains outstanding.

[frozen-comparison.json](frozen-comparison.json) preserves the passing frozen V8 live controls. They stop after consent and the first follow-up question. Their response is identical to the production consent response. They never exercise the subsequent confirmation/Why exchange. Therefore this is a demonstrated coverage gap and newly detected defect, not proof of a behavioral regression against a previously passing identical Why exchange. No grades are relaxed and no identical text is claimed as improved behavior.

## Focused repair
The shared eligibility constraint now requires current-provider evidence for Case 3 follow-up confirmation and explanation events. Necessary current assertion content vetoes unsupported temporary/definitive explanation flags. Historical, hypothetical, negated and interrogative content cannot independently satisfy the explanation checks. The model still supplies the semantic event; the guard never creates an event or question. Generic appointment/follow-up instructions cannot count as definitive treatment explanations. Prompt guidance reinforces current-turn scope.

The same constraint already runs after classification and again in transactional final assembly. Existing once-only selection, serializable persistence and final validation are preserved. No schema, migration, authentication, speech, provider configuration or case-fact changes.

New tests reproduce the reconstructed false-positive flags and cover paraphrases, partial explanations, genuine complete explanations, negation, hypothetical/history scope, provenance, closure, contaminated prior state, missing prerequisites and once-only behavior. A separate test exercises the actual classifier and actual final assembly service with a synthetic provider and isolated in-memory repository: failed final validation commits nothing, retry emits Why, repeated request is idempotent, subsequent turn cannot emit twice, and an already-explained control suppresses Why. These are deterministic integration tests, not live Navigator or real PostgreSQL concurrency tests.

## Validation and recommendation
Final results are recorded incrementally in [checks-final.json](checks-final.json). Earlier attempts remain in [checks-first.json](checks-first.json) and [checks-expanded-counterexample.json](checks-expanded-counterexample.json), including an expanded valid-explanation counterexample that failed during development and was repaired before the final run. Historical validation outputs rewritten by existing test scripts are copied under ignored `dev-output/case3-production-followup/validation-reruns/` and restored to their committed originals; previous evidence is preserved.

Production build uses Node v24.14.1 / Next 16.2.10, local public Clerk settings, dummy unreachable local database URLs, and no Navigator credentials. It does not exercise external authentication, model calls, database migrations or production speech. Next emits a nested-worktree multiple-lockfile root warning; compilation and static generation are successful. Existing dependency audit reports 26 advisories; dependencies and lockfile were not changed by this focused repair.

Recommend reviewing this focused fix and then authorizing a targeted production verification of the full two-question Case 3 exchange after a separately authorized deployment. No full 546-item run is warranted by the narrowly scoped guard without contrary evidence. Production remains on the original release; no merge, push, deployment or rollback was performed. Human speech audibility is not assessed in this investigation.
