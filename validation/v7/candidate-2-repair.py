from pathlib import Path
p=Path('src/lib/patientBackgroundTurn.ts');s=p.read_text().replace('(?:care|clinic|dentist|options?)','(?:care|clinics?|dentists?|options?)');p.write_text(s)
p=Path('src/lib/patientDisclosure.ts');s=p.read_text().replace('pain_quality: /\\b(what.*feel|describe.*pain|quality|throbb|sharp|dull|aching)\\b/i,','pain_quality: /\\b(?:what.*feel|describe.*pain|(?:describe|how).*\\b(?:tooth|pain)\\b.*feel|quality|throbb|sharp|dull|aching)\\b/i,');s=s.replace('  const caseSpecificFacts =','''  // Descriptive pain prompts ask for known quality/current pattern, not hidden location.
  if (caseId === "case-04" && classification.questionIntents.includes("pain_quality")) {
    return facts.filter(f => ["c4.constant", "c4.biting"].includes(f.id));
  }
  const caseSpecificFacts =''');s=s.replace('const asksQuality = /\\b(?:feel like|describe.{0,25}pain|quality)\\b/.test(normalizedQuestion);','const asksQuality = QUESTION_INTENT_PATTERNS.pain_quality.test(normalizedQuestion);');s=s.replace('  if (asksQuality && asksProvocation) return facts.filter(fact => ["c5.quality", "c5.cold", "c5.chewing"].includes(fact.id));','''  if (asksQuality) return facts.filter(fact => fact.id === "c5.quality" || asksProvocation && ["c5.cold", "c5.chewing"].includes(fact.id));''');s=s.replace('if (/\\b(?:which|exact|what)\\b.*\\b(?:tooth|tooth number)\\b|\\bfirst molar\\b/.test(normalizedQuestion))','if (isPatientPainLocationQuestion(question) || /\\bexact (?:tooth|tooth number)\\b|\\bfirst molar\\b/.test(normalizedQuestion))');p.write_text(s)
p=Path('src/lib/patientOutputGuard.ts');s=p.read_text().replace('"c5.quality": /\\bdeep\\b.{0,25}\\bthrobbing\\b|\\bthrobbing\\b.{0,25}\\bdeep\\b/i,','"c5.quality": /\\b(?:deep|throbbing)\\b/i,');p.write_text(s)
p=Path('src/lib/patientCanonicalAssertions.ts');s=p.read_text().replace('  const hasDaughter =', '''  // Attribute provenance, independent of which question or route produced this text.
  // Quality vocabulary describes clinical attributes, not a list of question/answer patches.
  const qualityWords = ["sharp", "throbbing", "deep", "dull", "burning", "stabbing", "shooting"];
  if (/\\b(?:pain|hurts?|ache|feels?)\\b/.test(assertions)) {
    const unsupportedQuality = qualityWords.find(word => new RegExp(`\\\\b${word}\\\\b`).test(assertions) && !new RegExp(`\\\\b${word}\\\\b`).test(corpus));
    if (unsupportedQuality) return reject(`unsupported pain quality: ${unsupportedQuality}`);
  }
  const hasDaughter =''');start=s.index('  const childCondition =');end=s.index('\n  if (!daughterHasProvider',start);s=s[:start]+'''  const childCondition = originalClauses.some(clause => {
    const c = clause.toLowerCase();
    return /\\b(?:my daughter(?:'s teeth)?|her teeth|she)\\b.{0,60}\\b(?:needs?|has|have|is|are|hurts?)\\b/.test(c)
      && /\\b(?:teeth|tooth|dental|cavities|pain|attention|check[- ]?up)\\b/.test(c)
      && !/\\b(?:not sure|don't know|do not know|don't remember|prefer|would like|important to me)\\b/.test(c);
  });
  const childConditionSource = facts.some(f => /\\bdaughter\\b/i.test(f.text) && /\\b(?:toothache|cavities|dental problems|needs? treatment|dental work|needs? more attention)\\b/i.test(f.text));
  if (childCondition && !childConditionSource) return reject("unsupported child dental condition");''' +s[end:];p.write_text(s)
p=Path('src/lib/patientQuestions/eligibility.ts');s=p.read_text().replace('import type { PatientQuestionClassification }','import { PATIENT_QUESTION_CATALOG } from "./catalog";\nimport type { PatientQuestionClassification }');s+='''
/** The base answer never grants itself permission to ask. Only final state assembly adds questions. */
export function patientAnswerWithoutQuestions(text: string): string {
  let answer = text;
  for (const question of PATIENT_QUESTION_CATALOG) answer = answer.replaceAll(question.text, "");
  return answer.split(/(?<=[.!?])\\s+/).filter(sentence => !sentence.includes("?")).join(" ").trim();
}
''';p.write_text(s)
p=Path('src/lib/patientRoleResponse.ts');s=p.read_text().replace('import { normalizePatientDialogueWithDiagnostics }','import { patientAnswerWithoutQuestions } from "./patientQuestions/eligibility";\nimport { normalizePatientDialogueWithDiagnostics }');s=s.replace('!allowPatientInitiatedQuestion && requiredFacts.length > 0 && containsUnsolicitedQuestion','!allowPatientInitiatedQuestion && containsUnsolicitedQuestion');start=s.index('      const statements =');end=s.index('\n      // Keep',start);s=s[:start]+'      const statements = patientAnswerWithoutQuestions(normalized.text);'+s[end:];p.write_text(s)
p=Path('src/lib/persistence/services/patientQuestionService.ts');s=p.read_text().replace('import { constrainQuestionClassification }','import { constrainQuestionClassification, patientAnswerWithoutQuestions }');s=s.replace('        const groundedClassification =','        const baseAnswer = patientAnswerWithoutQuestions(input.baseResponse);\n        const groundedClassification =');s=s.replace('patientResponse: input.baseResponse, facts:', 'patientResponse: baseAnswer, facts:');s=s.replace('`${input.baseResponse.trim()} ${questionText}`','`${baseAnswer} ${questionText}`').replace(': input.baseResponse.trim();',': baseAnswer;');p.write_text(s)
