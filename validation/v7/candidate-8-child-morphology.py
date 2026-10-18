from pathlib import Path
p=Path('src/lib/patientBackgroundTurn.ts');s=p.read_text(encoding='utf8').replace('(?:teeth|tooth|pain|cavities|condition|problems?|treatment|needs?)','(?:teeth|tooth\\w*|pain|cavities|condition|problems?|treatment|needs?)');p.write_text(s,encoding='utf8')
