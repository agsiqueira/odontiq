from pathlib import Path
p=Path('src/lib/patientQuestions/eligibility.ts');s=p.read_text();s=s.replace('  const background = interpretBackgroundTurn(input.studentMessage, input.conversation, input.facts);\n  if (result.caseId === "case-04" && background && !background.clinicalRequested) {','''  // Evaluate the turn's acts independently: a background question cannot create a
  // plan, but a real plan in another clause must remain eligible for semantic review.
  const acts = input.studentMessage.split(/(?<=[.!?;])\\s+|,\\s*(?:and\\s+)?/).filter(s => s.trim());
  const backgroundOnly = acts.length > 0 && acts.every(act => {
    const background = interpretBackgroundTurn(act, input.conversation, input.facts);
    return background && !background.clinicalRequested;
  });
  if (result.caseId === "case-04" && backgroundOnly) {''');p.write_text(s)
p=Path('src/lib/patientCanonicalAssertions.ts');s=p.read_text().replace('(?:teeth|tooth|dental|cavities|pain|attention|check[- ]?up)','(?:teeth|tooth|dental (?:problems|condition|work|treatment)|cavities|pain|attention|check[- ]?up)');p.write_text(s)
p=Path('scripts/validateV7PatientRepair.ts');s=p.read_text().replace("import { constrainQuestionClassification }", "import { patientAnswerWithoutQuestions, constrainQuestionClassification }");s=s.replace("[['What brings you in?',", "[['What does it feel like?',\"It's throbbing.\"],['What brings you in?',");s=s.replace("const first=applyPatientQuestionClassification",'''assert.equal(qualify('case-04',"I will give you ibuprofen. What county do you live in?",'Duval County.').detectedEvents.painManagementOrDispositionDiscussed,true);
assert.equal(patientAnswerWithoutQuestions("I live in Duval County. Do I need an antibiotic?"),'I live in Duval County.');
assert.equal(patientAnswerWithoutQuestions("It hurts. Can I get an antibiotic? It has helped in the past when I had a toothache."),'It hurts.');
for(const [id,bad]of [['case-04','It feels sharp and throbbing.'],['case-05','It feels sharp and throbbing.']])assert(!validatePatientFinalResponse(bad,{canonicalFacts:facts(id)}).valid,bad);
for(const id of ['case-04','case-05']){const q=id==='case-04'?'Describe how your tooth feels.':'What does your tooth pain feel like?';const state=buildPatientDisclosureState({caseData:loadCase(id)!,conversation:[],latestStudentMessage:q});assert(state.allowedThisTurn.some(f=>f.id===(id==='case-04'?'c4.biting':'c5.quality')));}
const first=applyPatientQuestionClassification''');p.write_text(s)
