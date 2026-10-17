from pathlib import Path
p=Path('src/lib/patientImmediateResponse.ts');s=p.read_text(encoding='utf8');s+='''
/** A plan-only speech act calls for acknowledgment, with no new personal constraints.
 * This selects wording only: semantic question eligibility remains separate. */
export function planOnlyAcknowledgment(input: {
  intent: PatientDisclosureState["providerMessageIntent"];
  hasGovernedAnswer: boolean;
  requiredFacts: readonly unknown[];
}): string | undefined {
  return !input.hasGovernedAnswer && input.requiredFacts.length === 0
    && ["disposition_plan", "medication_plan", "treatment_plan"].includes(input.intent)
    ? "Okay, thank you." : undefined;
}
''';p.write_text(s,encoding='utf8')
p=Path('src/app/api/conversation/route.ts');s=p.read_text(encoding='utf8').replace('import { patientImmediateResponse }','import { patientImmediateResponse, planOnlyAcknowledgment }');start=s.index('    // A plan-only turn');end=s.index('    const storedTurn = await',start);s=s[:start]+'''    const planAcknowledgment = planOnlyAcknowledgment({ intent: disclosureState.providerMessageIntent,
      hasGovernedAnswer: Boolean(immediateResponse), requiredFacts: turnRequiredFacts });
    if (planAcknowledgment) finalResponseText = planAcknowledgment;
''' +s[end:];s=s.replace('        questionClassification: classificationResult ?? null,','        questionClassification: classificationResult ?? null,\n        planAcknowledgmentGoverned: Boolean(planAcknowledgment),');p.write_text(s,encoding='utf8')
p=Path('scripts/validateV7PatientRepair.ts');s=p.read_text(encoding='utf8').replace('import { patientImmediateResponse }','import { patientImmediateResponse, planOnlyAcknowledgment }');marker="const corrections=JSON.parse";s=s.replace(marker,'''assert.equal(planOnlyAcknowledgment({intent:'disposition_plan',hasGovernedAnswer:false,requiredFacts:[]}), 'Okay, thank you.');
for(const intent of ['question','closing','other'] as const)assert.equal(planOnlyAcknowledgment({intent,hasGovernedAnswer:false,requiredFacts:[]}),undefined);
assert.equal(planOnlyAcknowledgment({intent:'treatment_plan',hasGovernedAnswer:true,requiredFacts:[]}),undefined);
assert.equal(planOnlyAcknowledgment({intent:'medication_plan',hasGovernedAnswer:false,requiredFacts:[{id:'supported-answer'}]}),undefined);
const corrections=JSON.parse''');p.write_text(s,encoding='utf8')
