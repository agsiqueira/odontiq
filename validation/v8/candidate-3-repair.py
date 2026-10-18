from pathlib import Path
p=Path('src/lib/providerTurnScopes.ts');s=p.read_text();s='import { isTreatmentConsentRequest } from "./case3ConsentResponse";\n'+s;s=s.replace('export function patientRequestedText(message: string): string {','''export function patientRequestedText(message: string): string {
  // Consent is referential: its meaning requires the proposed treatment, not just
  // the final acknowledgment question. Reuse the existing consent contract.
  if (isTreatmentConsentRequest(message)) return message;''');p.write_text(s)
p=Path('scripts/validateV8PatientRepair.ts');s=p.read_text();needle='async function main(){';insert='''for(const consent of ["You have an abscess. I recommend an I&D to drain the infection and relieve the pressure. Is that okay?", "I recommend draining the abscess to release the pressure. Is that okay?"]) {
 assert.equal(patientRequestedText(consent),consent);
 const turn=buildPatientDisclosureState({caseData:loadCase('case-03')!,conversation:[],latestStudentMessage:consent});
 assert.equal(turn.providerMessageIntent,'treatment_consent');
 assert.deepEqual(turn.allowedThisTurn,[]);
}
''';s=s.replace(needle,insert+needle);p.write_text(s)
