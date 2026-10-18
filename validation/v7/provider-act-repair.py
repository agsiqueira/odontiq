from pathlib import Path
p=Path('src/lib/patientQuestions/types.ts');s=p.read_text().replace('  evidenceAliases: string[];\n};','''  evidenceAliases: string[];
  currentProviderAct?: "current_plan" | "history_or_symptom_question" | "background_screening" | "care_search_offer" | "explanation" | "other";
  currentPlanEvidence?: string;
};''',1);p.write_text(s)
p=Path('src/lib/patientQuestions/eligibility.ts');s=p.read_text().replace('import { interpretBackgroundTurn } from "../patientBackgroundTurn";\n','');start=s.index('  // Evaluate the turn');end=s.index('  // A substantive',start);s=s[:start]+'''  // Case 4's prerequisite is a provider act, not a topic. Preserve the model's
  // explicit act and verbatim current-message witness through final assembly.
  if (result.caseId === "case-04" && (result.currentProviderAct !== "current_plan"
    || !result.currentPlanEvidence?.trim()
    || !input.studentMessage.includes(result.currentPlanEvidence))) {
    result.detectedEvents.painManagementOrDispositionDiscussed = false;
  }
''' +s[end:];p.write_text(s)
p=Path('src/lib/patientQuestions/prompt.ts');s=p.read_text();s=s.replace('- evidence: an array containing only supplied short message aliases that support asserted true events','''- evidence: an array containing only supplied short message aliases that support asserted true events
${input.caseId === "case-04" ? `- currentProviderAct: exactly one of current_plan, history_or_symptom_question, background_screening, care_search_offer, explanation, other
- currentPlanEvidence: a verbatim quote from student-current that actually gives a current pain-treatment or disposition/follow-up plan, or an empty string if none.
A current_plan chooses a specific current treatment or follow-up action. An access-screening question, county for referral, acceptable fees or offering to look for options does not choose a plan. A symptom-history question is not a plan. Do not use patient-draft or prior context as the current plan witness.
For a mixed turn that both gives a plan and asks a background question, currentProviderAct may be current_plan; quote the actual plan portion only.
Only current_plan with a nonempty valid quote can support painManagementOrDispositionDiscussed=true.` : ""}''');s=s.replace('Do not return message IDs. Do not add fields or event names.','Do not return message IDs. Do not add fields other than those specified for this case or add event names.');p.write_text(s)
p=Path('src/lib/patientQuestions/schema.ts');s=p.read_text();s=s.replace('    "evidence",\n  ]);','    "evidence",\n    ...(input.caseId === "case-04" ? ["currentProviderAct", "currentPlanEvidence"] : []),\n  ]);');marker='  const detectedEvents: Partial<PatientQuestionEvents> = {};';s=s.replace(marker,'''  const providerActs = ["current_plan", "history_or_symptom_question", "background_screening", "care_search_offer", "explanation", "other"] as const;
  if (input.caseId === "case-04" && (!providerActs.includes(parsed.currentProviderAct as typeof providerActs[number]) || typeof parsed.currentPlanEvidence !== "string")) {
    return { success: false, reason: "missing-evidence", safeMetadata };
  }
  const detectedEvents: Partial<PatientQuestionEvents> = {};''');s=s.replace('      schemaVersion: 1,\n      caseId: input.caseId,','''      schemaVersion: 1,
      ...(input.caseId === "case-04" ? {
        currentProviderAct: parsed.currentProviderAct as typeof providerActs[number],
        currentPlanEvidence: parsed.currentPlanEvidence as string,
      } : {}),
      caseId: input.caseId,''');p.write_text(s)
p=Path('src/app/api/conversation/route.ts');s=p.read_text().replace('        baseResponse: finalResponseText,\n      } }','        baseResponse: finalResponseText,\n        questionClassification: classificationResult ?? null,\n      } }');p.write_text(s)
p=Path('scripts/validateV7PatientRepair.ts');s=p.read_text();s=s.replace("const qualify=(id:string,q:string,a:string)=>constrainQuestionClassification({classification:classification(id)","const qualify=(id:string,q:string,a:string,plan=false)=>constrainQuestionClassification({classification:{...classification(id),...(plan?{currentProviderAct:'current_plan' as const,currentPlanEvidence:q}:{})}");s=s.replace("qualify('case-04',q,'Thank you.')", "qualify('case-04',q,'Thank you.',true)");s=s.replace("'Duval County.').detectedEvents", "'Duval County.',true).detectedEvents");s=s.replace("'We will give ibuprofen and arrange dental follow-up.','Okay.')", "'We will give ibuprofen and arrange dental follow-up.','Okay.',true)");s=s.replace("'We will give ibuprofen.','Okay.')", "'We will give ibuprofen.','Okay.',true)");p.write_text(s)
