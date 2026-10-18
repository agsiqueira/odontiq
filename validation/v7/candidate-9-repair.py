from pathlib import Path
p=Path('src/lib/patientBackgroundTurn.ts');s=p.read_text(encoding='utf8')
s=s.replace('  const scopedUnknown = turn.requests.some', '''  // Uncertainty about one requested proposition must not negate another sentence's
  // explicit sourced answer. Evaluate child coverage within its own clause below.
  const childScopedUnknown = turn.requests.some(r => r.value === "unknown" && (r.concept === "child_condition" || r.concept === "child_provider"))
    && s.split(/[.!?;]|\\bbut\\b/).some(clause => /\\b(?:not sure|don't know|do not know|don't remember)\\b/.test(clause)
      && /\\b(?:condition|dental provider|tooth\\w*|teeth|cavities|dentist)\\b/.test(clause));
  const scopedUnknown = childScopedUnknown || turn.requests.some''')
old='''case "insurance": return r.subject === "daughter" ? /\\b(?:daughter|she|her)\\b.{0,35}\\bmedicaid\\b|\\bmedicaid\\b.{0,25}\\b(?:daughter|her)\\b/.test(s) && !/\\b(?:she|daughter)\\b.{0,20}\\b(?:not|no|doesn't)\\b/.test(s) :'''
new='''case "insurance": return r.subject === "daughter" ? s.split(/[.!?;,]|\\bbut\\b/).some(clause => /\\b(?:daughter|she|her)\\b.{0,35}\\bmedicaid\\b|\\bmedicaid\\b.{0,25}\\b(?:daughter|her)\\b/.test(clause)
      && !/\\b(?:not|no|doesn't|does not|not sure|don't know|do not know)\\b/.test(clause)) :'''
assert old in s;s=s.replace(old,new);p.write_text(s,encoding='utf8')
p=Path('scripts/validateV7PatientRepair.ts');s=p.read_text(encoding='utf8');s+='''\nconst compoundChild = interpretBackgroundTurn("Does your daughter have Medicaid, and does she have a toothache?", [], facts('case-03'))!;
assert(assessBackgroundAnswer(backgroundFallback(compoundChild), compoundChild).valid, 'Known coverage plus unknown child condition survives separate clauses');
assert(assessBackgroundAnswer("My daughter has Medicaid. I'm not sure whether she has cavities.", compoundChild).valid);
assert(!assessBackgroundAnswer("My daughter does not have Medicaid. I'm not sure about her dental condition.", compoundChild).valid);
assert(!assessBackgroundAnswer("I'm not sure whether my daughter has Medicaid. I'm not sure about her dental condition.", compoundChild).valid);
''';p.write_text(s,encoding='utf8')
