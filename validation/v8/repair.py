from pathlib import Path
p=Path('src/lib/patientQuestions/eligibility.ts');s=p.read_text(encoding='utf8');s='import { assessClinicalPlanWitness } from "./clinicalPlan";\n'+s;s=s.replace('|| !result.currentPlanEvidence?.trim()\n    || !input.studentMessage.includes(result.currentPlanEvidence)', '|| !assessClinicalPlanWitness(input.studentMessage, result.currentPlanEvidence).valid');p.write_text(s,encoding='utf8')
p=Path('src/lib/patientQuestions/stateMachine.ts');s=p.read_text(encoding='utf8');needle='  const next: PatientQuestionState = {';s=s.replace(needle,'''  // Case 4's plan event is current-turn evidence, never a durable unlock.
  if (input.caseId === "case-04") detectedEvents.painManagementOrDispositionDiscussed =
    input.classification.detectedEvents.painManagementOrDispositionDiscussed === true;
  const next: PatientQuestionState = {''');p.write_text(s,encoding='utf8')
p=Path('src/lib/patientQuestions/prompt.ts');s=p.read_text(encoding='utf8');s=s.replace('A background-only exchange cannot establish a clinical plan.', 'A background-only exchange cannot establish a clinical plan. Financial screening, payment preferences, insurance, and hypothetical care options are not clinical plans even when dental treatment is mentioned.\nFor mixed turns, distinguish an actual current clinical directive/commitment from the financial or hypothetical portion. Quote only the clinical action, not the entire screening question.');p.write_text(s,encoding='utf8')
p=Path('src/lib/persistence/services/patientQuestionService.ts');s=p.read_text(encoding='utf8');s=s.replace('''transition.state.emittedQuestionIds =
              transition.state.emittedQuestionIds.filter((id) => id !== transition.selectedQuestionId);''','''// Preserve the durable marker when an emission already exists.
            if (!transition.state.emittedQuestionIds.includes(transition.selectedQuestionId!)) {
              transition.state.emittedQuestionIds.push(transition.selectedQuestionId!);
            }''');s=s.replace('''        const responseText = questionText''','''        if (selectedQuestionId && !questionText) throw new Error("Selected patient question has no renderable text.");
        const responseText = questionText''');p.write_text(s,encoding='utf8')
