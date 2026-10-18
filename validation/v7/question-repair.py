from pathlib import Path
p=Path('src/lib/patientQuestions/eligibility.ts');p.write_text('''import { classifyProviderMessageIntent, type PatientDisclosureFact } from "../patientDisclosure";
import { interpretBackgroundTurn } from "../patientBackgroundTurn";
import { isPatientConversationClosure } from "../patientConversationClosure";
import { expressesRequiredFact } from "../patientOutputGuard";
import type { ConversationMessage } from "../conversationEngine";
import type { PatientQuestionClassification } from "./types";

/** Semantic classification is necessary, never sufficient: enforce scope and sourced evidence.
 * This veto does not grant permission based on words or turn count. The catalog/state machine
 * still require affirmative semantic events and enforce once-only emission transactionally.
 */
export function constrainQuestionClassification(input: {
  classification: PatientQuestionClassification;
  studentMessage: string;
  patientResponse: string;
  conversation: readonly ConversationMessage[];
  facts: readonly PatientDisclosureFact[];
}): PatientQuestionClassification {
  const result = { ...input.classification, detectedEvents: { ...input.classification.detectedEvents } };
  if (isPatientConversationClosure(input.studentMessage)) {
    for (const event of Object.keys(result.detectedEvents)) result.detectedEvents[event as keyof typeof result.detectedEvents] = false;
    return result;
  }
  const background = interpretBackgroundTurn(input.studentMessage, input.conversation, input.facts);
  if (result.caseId === "case-04" && background && !background.clinicalRequested) {
    result.detectedEvents.painManagementOrDispositionDiscussed = false;
  }
  // A substantive current-pain description must express an actual sourced attribute,
  // not a county, preference, general pain mention or the antibiotic question itself.
  if (result.caseId === "case-05") {
    const painFacts = input.facts.filter(f => /^c5\\.(?:location|duration|constant|quality|severity|spontaneous|nocturnal|cold|lingering|chewing|biting)$/.test(f.id));
    const patientTexts = [...input.conversation.filter(m => m.role === "patient").map(m => m.text), input.patientResponse];
    const substantive = patientTexts.some(text => {
      const answer = text.split(/(?<=[.!?])\\s+/).filter(s => !s.includes("?")).join(" ");
      return painFacts.some(fact => expressesRequiredFact(answer, fact));
    });
    if (!substantive) result.detectedEvents.patientPainDescribed = false;
  }
  return result;
}
'''.replace('import { classifyProviderMessageIntent, type PatientDisclosureFact }','import { type PatientDisclosureFact }'))
p=Path('src/lib/patientQuestions/classifier.ts');s=p.read_text().replace('import { buildPatientQuestionClassifierPrompt }', 'import { constrainQuestionClassification } from "./eligibility";\nimport { loadCase } from "@/data/cases";\nimport { buildPatientQuestionClassifierPrompt }');s=s.replace('    return parsePatientQuestionClassification({','    const parsed = parsePatientQuestionClassification({');s=s.replace('      evidenceAliases: prompt.evidenceAliases,\n    });','''      evidenceAliases: prompt.evidenceAliases,
    });
    return parsed.success ? { success: true, classification: constrainQuestionClassification({
      classification: parsed.classification,
      studentMessage: input.studentMessage,
      patientResponse: input.draftPatientResponse,
      conversation: input.conversation,
      facts: loadCase(input.caseId)?.supportingInfo.patientFacts ?? [],
    }) } : parsed;''');p.write_text(s)
p=Path('src/lib/patientQuestions/prompt.ts');s=p.read_text();s=s.replace('Do not select a patient question. Application code determines question eligibility.', '''Do not select a patient question. Application code determines question eligibility.
An asserted event requires evidence of that exact event, not merely discussion of a related topic.
Provider questions seeking history, symptoms, county, insurance or ability to pay are NOT treatment/disposition plans.
Looking/searching for care options is NOT giving a plan. A plan chooses an actual current treatment, referral or follow-up action.
A patient answer about county, insurance, payment or preferences is NOT a pain description.
Generic tooth pain without a substantive attribute is NOT patientPainDescribed.
A substantive pain description may occur in an opening complaint or later answer; never use turn count.
Do not infer events from the case scenario, intended future care or a patient's appended question.
For a background-only exchange all clinical events should be false.
Example: provider asks county; patient says Duval County => painManagementOrDispositionDiscussed=false.
Example: provider gives ibuprofen plan and directs dentist follow-up => painManagementOrDispositionDiscussed=true.
Example: patient says tooth pain keeps waking me => patientPainDescribed=true.
Example: patient says I am focused on my tooth pain => patientPainDescribed=false.''');p.write_text(s)
# Recheck evidence in the persistence boundary, so alternative/retry/fallback callers share the veto.
p=Path('src/lib/persistence/services/patientQuestionService.ts');s=p.read_text().replace('import "server-only";', 'import "server-only";\nimport { constrainQuestionClassification } from "@/lib/patientQuestions/eligibility";\nimport type { ConversationMessage } from "@/lib/conversationEngine";');s=s.replace('    classification?: PatientQuestionClassification;', '''    classification?: PatientQuestionClassification;
    questionEvidence?: { studentMessage: string; conversation: readonly ConversationMessage[] };''');s=s.replace('        const transition = input.classification','''        const groundedClassification = input.classification && input.questionEvidence
          ? constrainQuestionClassification({ classification: input.classification, ...input.questionEvidence,
              patientResponse: input.baseResponse, facts: loadCase(input.caseId)?.supportingInfo.patientFacts ?? [] })
          : undefined;
        const transition = groundedClassification''').replace('classification: input.classification,\n            })','classification: groundedClassification,\n            })');p.write_text(s)
p=Path('src/app/api/conversation/route.ts');s=p.read_text();s=s.replace('    if (coreResponse) {\n      const storedCoreTurn', '''    if (coreResponse) {
      const corePatientMessageId = crypto.randomUUID();
      const coreClassification = coreResponse.intent === "chief_complaint" && shouldClassifyPatientQuestions(payload.caseId, questionContext.state)
        ? await classifyPatientQuestionTrigger({ provider: getAIProvider(), caseId: payload.caseId,
            studentMessageId: payload.studentMessageId, studentMessage: payload.message,
            draftPatientMessageId: corePatientMessageId, draftPatientResponse: coreResponse.text,
            conversation: payload.conversation, state: questionContext.state }) : undefined;
      const storedCoreTurn''');s=s.replace('        patientMessageId: crypto.randomUUID(),\n        baseResponse: coreResponse.text,','        patientMessageId: corePatientMessageId,\n        baseResponse: coreResponse.text,');s=s.replace('        providerName: "governed-patient-core",\n        questionText: () => undefined,','''        providerName: "governed-patient-core",
        classification: coreClassification?.success ? coreClassification.classification : undefined,
        questionEvidence: { studentMessage: payload.message, conversation: payload.conversation },
        questionText: id => getPatientQuestion(id as Parameters<typeof getPatientQuestion>[0])?.text,''');s=s.replace('      classification:\n        classificationResult?.success','      questionEvidence: { studentMessage: payload.message, conversation: sanitizedConversation },\n      classification:\n        classificationResult?.success');p.write_text(s)
