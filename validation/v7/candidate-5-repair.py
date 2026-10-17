from pathlib import Path
p=Path('src/lib/patientDisclosure.ts');s=p.read_text(encoding='utf8');old='''  return !asksResidenceOnly
    && /\\b(?:where|location|which (?:tooth|teeth)|what (?:tooth|teeth)|side|left|right|upper|lower|what hurts|which one hurts)\\b/i.test(normalized);''';new='''  const explicitLocation = /\\b(?:where|location|which (?:tooth|teeth)|what (?:tooth|teeth)|side|what hurts|which one hurts)\\b/i.test(normalized);
  // A direction must be a place/choice, rather than an unrelated adverb.
  const anatomicalDirection = /\\b(?:left|right|upper|lower)\\b.{0,20}\\b(?:tooth|teeth|molar|jaw|side|mouth)\\b|\\b(?:tooth|teeth|molar|jaw|side|mouth)\\b.{0,20}\\b(?:left|right|upper|lower)\\b/i.test(normalized);
  const directionChoice = /\\b(?:left|right|upper|lower) (?:or|versus|vs) (?:left|right|upper|lower)\\b|\\b(?:on|in|to) (?:the |your )?(?:left|right|upper|lower)\\b/i.test(normalized);
  return !asksResidenceOnly && (explicitLocation || anatomicalDirection || directionChoice);''';assert old in s;s=s.replace(old,new);p.write_text(s,encoding='utf8')
p=Path('scripts/validateV7PatientRepair.ts');s=p.read_text(encoding='utf8');marker="for(const good of [";s=s.replace(marker,'''for(const question of ['Cold then stop right away or keeps hurting?','Does it stop right away after cold is removed?']){
 const s=buildPatientDisclosureState({caseData:loadCase('case-05')!,conversation:[],latestStudentMessage:question});
 assert(!requiredFactsForTurn(s,question,facts('case-05')).some(f=>f.id==='c5.location'),question);
}
for(const question of ['Where does it hurt?','Is it on the right or left?','Which tooth hurts?']){
 const s=buildPatientDisclosureState({caseData:loadCase('case-05')!,conversation:[],latestStudentMessage:question});
 assert(requiredFactsForTurn(s,question,facts('case-05')).some(f=>f.id==='c5.location'),question);
}
''' +marker,1);p.write_text(s,encoding='utf8')
