from pathlib import Path
p=Path('src/lib/patientQuestions/clinicalPlan.ts');s=p.read_text();s=s.replace('''(medicine.test(action)
      || /^(?:a |the |your )?(?:dentist|oral surgeon)\\b/.test(action));''','''(new RegExp(`^(?:an? |the |some )?${medicine.source}`).test(action)
      || /^(?:a |the |your )?(?:dentist|oral surgeon|dental (?:care|treatment|follow.?up))\\b/.test(action));''');p.write_text(s)
