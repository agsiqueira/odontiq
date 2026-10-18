# Final trigger/knowledge protocol separation

Keep repair-5's independent evidence collection, positive requirement predicate, durable source witnesses and `gpt-oss-120b` verifier. Patient responses and trigger classification remain on Granite. The exact model dependency, positive confidence threshold and limits are recorded in repair-5/CONFIGURATION.md.

Repair-5's complete suite is preserved: 7 PASS / 15 FAIL. Adding explanation fields to Granite's initial trigger schema caused it to return its established three-field consent decision without the two extra keys; the strict parser correctly rejected that output. The separate split-turn preflight passed but did not erase those full-suite failures.

This revision restores the established initial trigger protocol unchanged. Explanation knowledge is processed independently at every Case 3 stage, including when that trigger protocol rejects a response. A rejected trigger cannot emit a question (`questionDecisionVerified=false`), but independently verified current-message explanations can persist with a valid final answer. No missing trigger fields are silently filled and no parser/grade is weakened. Clinical facts are not added to a trigger schema just to make them durable.

All earlier runs and verdicts remain in their original directories. The complete permanent suite and grading remain the same as repair-3 through repair-5. Model configuration: Granite 3.3 8B for generation/triggers, Navigator gpt-oss-120b for explanation verification, optional NAVIGATOR_EXPLANATION_MODEL override, 2048-token verifier budget, existing timeout and bounded transport retry policy. No production environment changes or migrations. Production model-key access must be checked before any separately authorized promotion.
