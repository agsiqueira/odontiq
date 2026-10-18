# PR #3 repair 2: explanation evidence and durable answered knowledge

Authority: faculty clinical facts and the V7 question catalog remain unchanged. The user's explicit instruction for this repair resolves the previously recorded scope gap: “Preserve validated explanations across turns so ‘Why?’ is not asked after its reason has already been explained.” This supersedes the earlier current-turn-only suppression behavior, not the clinical meaning of either explanation. Historical reports and verdicts are retained unchanged.

Each explanation must first be established from the current clinician message, independently of patient output, case facts, and earlier dialogue. The temporary reason describes drainage's pressure/infection-relief or nondefinitive effect. The definitive reason explains required root canal, extraction or equivalent treatment of the underlying dental cause. A dentist instruction or appointment alone establishes neither. Naming/proposing a procedure alone does not explain its effect. Negation, a history question or hypothetical treatment cannot establish a present requirement. Clinical equivalents are interpreted semantically, without a list of accepted literal utterances.

The verifier must supply a separate verbatim current-message witness for each accepted reason at confidence >=0.85. Missing, malformed, low-confidence or invented witnesses fail closed. Only accepted witnesses become durable answered knowledge, committed with the final validated response in the existing serializable transaction. Failed generation, classification, verification or final validation cannot add a witness or consume a question. Legacy boolean event flags cannot establish answered knowledge.

The two validated reasons may arrive on the same turn, during consent or on different turns. They retain independent source message IDs and quotes in the persisted question state. A later bare confirmation cannot erase them. Why still requires the previously emitted first follow-up question and a current prompt-dental-follow-up confirmation; if both reasons are known it is suppressed, otherwise it remains available exactly once. A closure does not restart the encounter. No turn count grants eligibility.

Permanent-suite expectation changes are explicit:

- `prior-explanation-current-confirmation`: Why is now forbidden because both reasons were explicitly given during consent. Its earlier contract PASS and whole-conversation FAIL remain in the historical report.
- `definitive-only`: its original consent already explains drainage relieving pressure. A later definitive explanation completes the two independent reasons, so Why is now forbidden. Added `definitive-without-temporary` uses a consent that only proposes I&D, to retain a genuine definitive-only counterexample where Why remains eligible.
- Complete-explanation controls must suppress Why both immediately and on a later bare confirmation. This is the prior stronger whole-conversation criterion, not a relaxation.
- Added split-turn explanations, clinical equivalents, hypothetical/negative/question counterexamples and explanation-verifier failure injection. The original five repetitions retain identical questions/context and the same exactly-once criterion.

This repair does not resolve the separate broader faculty/application disagreement about which temporary treatments permit the first follow-up question. No faculty facts, first-question rules, authentication, speech or database schema are changed.
