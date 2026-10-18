from pathlib import Path
p=Path('src/lib/patientQuestions/clinicalPlan.ts');s=p.read_text();needle='    const medicine = ';insert='''    // Check the action's direct object, not a clinical noun inside a financial
    // purpose phrase. A fee modifier after an actual referral is not the object.
    const directObject = action.replace(/^(\\w+)\\s+for\\s+/, "$1 ").split(/\\b(?:for|to|with|at|through)\\b/)[0];
    if (/\\b(?:payments?|fees?|costs?|insurance|coverage|money|funds|billing)\\b/.test(directObject)) continue;
''';assert needle in s;s=s.replace(needle,insert+needle);p.write_text(s)
p=Path('src/lib/persistence/services/patientQuestionService.ts');s=p.read_text();s=s.replace('if (selectedQuestionId && !questionText)', 'if (selectedQuestionId && !questionText?.trim())');p.write_text(s)
p=Path('src/lib/patientDisclosure.ts');s=p.read_text();s='import { patientRequestedText } from "./providerTurnScopes";\n'+s;s=s.replace('''export function isPatientPainSeverityQuestion(question: string): boolean {
  const normalized''','''export function isPatientPainSeverityQuestion(question: string): boolean {
  question = patientRequestedText(question);
  const normalized''');s=s.replace('''  const latestClassification = classifyQuestion(latestStudentMessage);
  const backgroundTurn = interpretBackgroundTurn(latestStudentMessage, conversation, facts);''','''  const requestedMessage = patientRequestedText(latestStudentMessage);
  const latestClassification = classifyQuestion(requestedMessage);
  const backgroundTurn = interpretBackgroundTurn(requestedMessage, conversation, facts);''');s=s.replace('''    question: latestStudentMessage,
  });
  const sourceIds''','''    question: requestedMessage,
  });
  const sourceIds''');s=s.replace('/\\bappointment\\b/i.test(latestStudentMessage) && !backgroundTurn', '/\\bappointment\\b/i.test(requestedMessage) && !backgroundTurn');p.write_text(s)
p=Path('src/lib/patientBackgroundTurn.ts');s=p.read_text();s='import { patientRequestedText } from "./providerTurnScopes";\n'+s;s=s.replace('const q = normalize(message);','const q = normalize(patientRequestedText(message));');p.write_text(s)
p=Path('src/lib/patientTurnFacts.ts');s=p.read_text();s='import { patientRequestedText } from "./providerTurnScopes";\n'+s;s=s.replace('''  // The shared contract''','''  studentMessage = patientRequestedText(studentMessage);
  // The shared contract''');p.write_text(s)
p=Path('scripts/validateV7PatientRepairForV8.ts');s=p.read_text();s=s.replace("fs.readFileSync('validation/v8/results.json'", "fs.readFileSync('validation/v6/results.json'");p.write_text(s)
p=Path('scripts/validateV8PatientRepair.ts');s=p.read_text();s=s.replace("import fs from 'node:fs';", "import fs from 'node:fs';\nimport { loadCase } from '../src/data/cases';\nimport { buildPatientDisclosureState, isPatientPainSeverityQuestion } from '../src/lib/patientDisclosure';\nimport { requiredFactsForTurn } from '../src/lib/patientTurnFacts';\nimport { patientRequestedText } from '../src/lib/providerTurnScopes';");s=s.replace("'We will arrange payment for a dental visit.',", "'We will arrange payment for a dental visit.', 'I will arrange payment for a dentist.', 'We will schedule a payment for dental care.',");s=s.replace("'I recommend that you see a dentist.',", "'I recommend that you see a dentist.', 'I will refer you to a sliding-fee dental clinic.', 'We will arrange an appointment with a dentist.',");needle='async function main(){';insert='''const mixed = 'I will give you ibuprofen for pain. Would a sliding-scale fee be acceptable?';
assert.equal(patientRequestedText(mixed), 'Would a sliding-scale fee be acceptable?');
assert(!isPatientPainSeverityQuestion(mixed));
for (const id of ['case-01','case-02','case-03','case-04','case-05']) {
 const turn = buildPatientDisclosureState({caseData:loadCase(id)!,conversation:[],latestStudentMessage:mixed});
 assert(!turn.backgroundTurn?.clinicalRequested, id);
 assert(!turn.allowedThisTurn.some(f=>f.topic==='pain'), id);
 assert(!requiredFactsForTurn(turn,mixed,loadCase(id)!.supportingInfo.patientFacts).some(f=>f.topic==='pain'), id);
}
for(const q of ['I will give you ibuprofen for pain. How severe is your pain?', 'Do you have insurance, and how severe is your pain?', 'How severe is your pain on a scale of ten?']) {
 assert(isPatientPainSeverityQuestion(q),q);
 const turn=buildPatientDisclosureState({caseData:loadCase('case-04')!,conversation:[],latestStudentMessage:q});
 assert(turn.allowedThisTurn.some(f=>f.id==='c4.severity'),q);
}
assert.equal(patientRequestedText('If we could refer you to a dentist, would that be an option?'),'If we could refer you to a dentist, would that be an option?');
''';s=s.replace(needle,insert+needle);p.write_text(s)
p=Path('validation/v8/verify-transactions.mjs');s=p.read_text();s=s.replace("['missing-question-text',{questionText:()=>undefined}],", "['missing-question-text',{questionText:()=>undefined}],['blank-question-text',{questionText:()=> '   '}],");p.write_text(s)
