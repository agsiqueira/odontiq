from pathlib import Path
p=Path('src/lib/patientOutputGuard.ts');s=p.read_text(encoding='utf8');old='''    "c5.cold": /\\bcold\\b.{0,45}\\b(?:worse|hurt|pain)\\b|\\b(?:worse|hurt|pain)\\b.{0,45}\\bcold\\b/i,''';new='''    "c5.cold": /\\bcold(?: drinks?| water| food)?\\b.{0,20}\\b(?:worsen\\w*|hurts?|causes? pain|makes? (?:it|the pain|my tooth) (?:worse|hurt))\\b|\\b(?:pain|it)\\b.{0,20}\\b(?:worse|worsen\\w*)\\b.{0,35}\\bcold\\b/i,''';assert old in s;s=s.replace(old,new);p.write_text(s,encoding='utf8')
p=Path('scripts/validateV7PatientRepair.ts');s=p.read_text(encoding='utf8');marker="for(const good of [";s=s.replace(marker,'''const coldFact=facts('case-05').find(f=>f.id==='c5.cold')!;
const lingerFact=facts('case-05').find(f=>f.id==='c5.lingering')!;
assert(!validatePatientFinalResponse('The pain lingers after I remove the cold drink.',{canonicalFacts:facts('case-05'),visibleFacts:[coldFact,lingerFact],requiredFacts:[coldFact,lingerFact]}).valid,'Cold/pain co-occurrence is not an assertion that cold worsens pain');
assert(validatePatientFinalResponse('The pain lingers after I remove the cold drink.',{canonicalFacts:facts('case-05'),visibleFacts:[lingerFact],requiredFacts:[lingerFact]}).valid,'A persistence-only answer remains valid when only persistence is requested');
for(const t of ['Cold drinks make the pain worse.','Cold worsens it.','It gets worse when I drink something cold.'])assert(validatePatientFinalResponse(t,{canonicalFacts:facts('case-05'),visibleFacts:[coldFact],requiredFacts:[coldFact]}).valid,t);
''' +marker,1);p.write_text(s,encoding='utf8')
