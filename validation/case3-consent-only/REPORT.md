# Case 3 consent-only repair

Tested application **c0394fd838ebe8995507a7305004735f53524b6f**, based directly on deployed V8 **69a24fe9fb6d1121e67da8d2ce70cc02b574266c**. Production build **v96_7LOG3Ntpb5h74WfIT**, Node **v24.14.1**, Next **16.2.10**, Navigator **granite-3.3-8b-instruct**. All **229 frozen application/configuration hashes** remained unchanged. No production requests, settings, encounters, merge, deployment, or rollback were performed. PR #3 remains draft at 1efc395a4ca9c533977dfccd6d2c1eff2ccfb460; its slower explanation repair was not ported.

## Six recorded failures and root cause

[baseline-routing.json](baseline-routing.json) preserves all six original production observations with exact clinician text, preceding dialogue, actual response, encounter/request IDs and evidence filenames. Its internal routing fields are a deterministic reconstruction against exact V8 source, not claimed original production instrumentation. One source is repair-7/paired-latency.json, five are repair-8/paired-latency.json in the preserved PR #3 evidence. No original verdict was changed.

After the opening complaint and “Draining the infection only relieves pressure; it does not provide definitive tooth treatment.”, the clinician said:

> I recommend an I&D for the abscess. Your dentist still needs to remove the affected tooth. Is that okay?

V8 returned:

> That lower-right back tooth has a crown or cap. I'm not sure whether that tooth had a root canal or its nerve removed. I have an appointment with my dentist next week, and I still plan to go. Yes, I have had a lot of dental work in the past. I don't remember exactly which teeth were treated. No, that tooth is still there and has a crown on it. I called my dentist a couple of days ago.

The consent recognizer knows `I&D` as a drainage action but omitted it from treatment subjects. The exact message therefore fell through to generic question intent and selected seven dental-history facts as required. Fact fallback reconstructs the exact recorded dump. A second gate unnecessarily required the current consent utterance to repeat the procedure's purpose. Short proposals could consequently generate vague acknowledgments that did not reliably establish consent for the first follow-up.

The minimal consent change from PR #3 reuses the drainage-action recognizer as a treatment subject and removes that same-turn purpose requirement. Focused testing additionally exposed a grammatical recognition gap (`make` versus `making`) and disagreement between consent recognition and the separate classifier evidence validator for “making a small opening to let the pus out.” The final repair shares the consent recognizer at the two evidence-reference gates, retaining semantic classification, current-plan/history/hypothetical/negation checks, evidence roles, confidence, state prerequisites and transactional once-only emission. The additional shared-reference path conservatively rejects negated/declined messages. No exact-question exception or question-specific response patch was added.

Only **src/lib/case3ConsentResponse.ts** and **src/lib/patientQuestions/schema.ts** change application behavior. Catalog, state machine, prompt, model provider, final assembly, transaction implementation, authoritative facts, authentication, schema/migrations and speech are unchanged. There are no extra model calls, GPT-OSS configuration, durable explanation fields or explanation verifier.

## Authority and scope

[V7 AUTHORITY](../v7/AUTHORITY.md) Case 3 paragraphs 49–50 place agreement and the first dental-follow-up question after a current abscess-drainage proposal. [CONTRACT](../v7/CONTRACT.md) records the existing faculty/application timing conflict; this repair preserves that contract and does not resolve or redefine it. Recognition now accepts supported drainage consent expressions consistently. An affirmative Granite classification with compatible source evidence remains necessary.

The Case 3 **“Why?” omission remains accepted/deferred**, with its original failed production result retained in validation/case3-production-followup evidence on PR #3. This PR neither fixes nor counts it as a pass. The focused conversation stops at consent, first follow-up, repeated consent and closure; it makes no new claim about subsequent explanation handling.

## Verification and preserved intermediate failures

- **41/41 automated checks**, including typecheck, lint and production build; final expanded consent test rechecked after its additional fixtures. Additional verification-script lint passed.
- Consent regression coverage: **11 positive messages, 13 boundaries**, history controls, full existing question-state sequence, once-only and resume; six additional schema evidence controls cover supported opening/incision wording, negation, hypothetical, history and unrelated root canal. No network model is used for automated fixture classification.
- **12/12 final candidate live scenarios PASS**, **56 first-attempt conversation requests**, through protected APIs, production server, actual Navigator and isolated PostgreSQL. Five fresh exact original sequences passed; five more current-procedure formulations passed; two history controls passed. All final responses and complete contexts were semantically reviewed in [adjudication.json](adjudication.json), independently of provisional structural REVIEW labels retained in raw results.
- Unchanged local V8 control: **2 PASS / 10 FAIL**, 56 first-attempt conversation requests. It reproduced the original history dump in **5/5 fresh encounters**. Successful unchanged history text is not counted as a behavioral improvement. Exact attempts/state/turn/emissions and IDs: [live results](live-results.json), [call-correlated results](live-results-with-call-counts.json).
- **13 candidate and 12 control fresh encounter setups succeeded**, including the final failure control. Two earlier infrastructure-only setup problems are preserved in setup-network-blocked.json and setup-auth-redirect.json. The latter returned login HTML, with no scored conversation delivered or persisted; its invalid encounter handling was corrected in the harness. Local servers/proxy required network permission for Clerk/Navigator. No application authentication bypass was added.
- [Final live failure control](live-failure-control.json): two injected classifier 503s exhaust the existing bounded retry. Delivered response is “Yes, that’s okay.” with no question or emission consumed. A planned new-turn recovery emits the first follow-up once. Same-request replay returns the stored response without a new emission; a new-turn repeat does not ask again. Each attempt is preserved separately. [Real PostgreSQL transaction fixture](transaction-check.json) verifies final-response rejection rolls back state, turn and emission; same-request recovery, idempotency and repeat remain sound.
- Intermediate candidates **cb1279c** and **81cd2d8** each retain the additional opening/pus first-follow-up omission as **FAIL** in live-results-initial/second and adjudication-initial/second. Their raw captures, fault controls and freezes remain separate. The final candidate is a code revision, not a retry relabeled PASS. No request was retried merely to obtain a favorable semantic outcome.

## Matched latency and model calls

Same machine, separate local production builds/databases, exact V8 source versus final candidate, same existing Granite model, sequential paired scenarios with alternating order. API duration includes server/authentication verification/database/model/final assembly but excludes token acquisition. Each target retains its own actual conversation. No overlapping benchmark work or production writes. This controls host/network differences better than comparing localhost with Render; it is not a measurement of deployed Render latency. Sample size is focused; p95 uses nearest rank.

| Measure | V8 control | Repair |
|---|---:|---:|
| All 56 requests: median / p95 | 770 / 2,105 ms | 565.5 / 888 ms |
| 10 first consent turns: median / p95 | 1,406.5 / 2,183 ms | 567 / 605 ms |
| Model HTTP attempts | 87 | 58 |
| Classifier / generation attempts | 44 / 43 | 44 / 14 |
| Real upstream non-200 | 0 | 0 |

No substantial slowdown was observed. The classifier call count is unchanged; deterministic grounded consent avoids unnecessary generation/repair attempts. All calls used Granite; zero GPT-OSS or separate explanation requests. Artificial replay/fault-control requests are outside the matched benchmark and remain in their separate evidence. [summary.json](summary.json) and credential-redacted navigator-attempts.jsonl preserve measurements and raw model requests/responses.

## Limits and release status

No remaining non-pass in this final focused suite. This is not another 546-item verification and does not supersede V8's broader evidence. API final text, persisted response and encounter/request correlation were checked on every scored request; browser rendering and speech were not retested. No new claim of human audibility is made. The known deferred Why defect and documented authority gap remain release limitations. No environment/database migration is required. This is a separate draft PR for review, not authorization to merge or deploy.

All prior evidence, historical worktrees, PhaseT tooling/uncommitted files and original root work were preserved. New test databases and exactly identified synthetic encounters are retained locally. Only newly created, explicitly recorded Clerk sessions were revoked; no historical sessions were cleaned up.
