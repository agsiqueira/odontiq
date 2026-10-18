# Patient-question authority locations

Reference appendix only; the behavioral contract and cross-version rubric were established in CONTRACT.md before implementation. Paragraph numbers below are the saved one-based extraction indexes in authoritative-source-evidence.json (word/document.xml), not inferred page numbers. Original DOCX files and hashes are preserved.

## Case 1

Source: docs/faculty-specifications/case-01-ludwigs.docx; SHA256 256f295d9175ea3b8780ca1bb899c792d1523d52d3555fe8561324c201bc449e.

- Paragraph 38: You can ask the provider, “Can you prescribe me some antibiotics and let me go home?”
- Paragraph 45: This is a life-threatening emergency. The ED provider should ensure you can continue breathing. You will be admitted to the hospital for surgical management and will be started on IV fluids, pain medication, and antibiotics. You will be kept on oxygen. They will perform some lab work and arrange a CT scan. They will consult with an oral and maxillofacial surgeon.
- Paragraph 46: Ask the provider, “Will they pull out the bad tooth?”

## Case 2

Source: docs/faculty-specifications/case-02-systemic-infection.docx; SHA256 a43b4bbabb17d0aa13a360801410ffd8b2d6b3a2943af1bbc29014168e7e1b52.

- Paragraph 45: 1. Antibiotic Therapy
- Paragraph 51: Ask the provider, “Will the antibiotic make the tooth better?”
- Paragraph 54: Antibiotics alone are not a definitive treatment

## Case 3

Source: docs/faculty-specifications/case-03-periapical-abscess.docx; SHA256 cb97ef3d664ff0f9a0ad02a35246f0fb21a7270eb4c1e8ffa4a4b52e54e8f91a.

- Paragraph 49: The provider should also offer to drain the abscess, after numbing the tooth, they will make a little cut into the abscess and let it drain to decrease the pressure and relieve the pain
- Paragraph 50: You agree to the procedure and ask the provider, “Since I am going to do this, do I not need to see my dentist soon?”
- Paragraph 51: If the provider says no, ask them, “Why?”
- Paragraph 55: Antibiotic Therapy
- Paragraph 56: The provider should prescribe you an antibiotic

## Case 4

Source: docs/faculty-specifications/case-04-necrotic-pulp-with-acute-apical-periodontitis.docx; SHA256 3a61ca05c3d27c8a67316fbdfac9bee52ae117a39aa7cc841d23a754a2130c6b.

- Paragraph 53: Antibiotics are not needed for your case; however, the provider should provide an antibiotic prescription and tell you that you only need to take the antibiotic if you start developing fevers, swelling, or you see pus in your gum (abscess on the gums)
- Paragraph 59: The provider should ask you if you can see a dentist. You should say it will take a while for you to figure that out
- Paragraph 65: The provider should ask you if you would like to save your tooth. You want to save your tooth.

## Case 5

Source: docs/faculty-specifications/case-05-irreversible-pulpitis.docx; SHA256 a49bed8f5799443646506a6ebda1ad678722787d2b9701a80b61469143440511.

- Paragraph 49: Ask the provider, “Can I get an antibiotic? It has helped in the past when I had a toothache.”
- Paragraph 54: The provider should ask you if you can see a dentist. You should say it will take a while for you to figure that out
- Paragraph 55: Antibiotics are not needed for your case (you can ask the provider for antibiotics, but they should not prescribe them)
- Paragraph 61: The provider should ask you if you would like to save your tooth.

## Existing executable policy and enforcement

Clinical authority designation: docs/faculty-specifications/README.md. Catalog and once-only prerequisites: src/lib/patientQuestions/catalog.ts. Semantic event definitions and case-specific scope: src/lib/patientQuestions/prompt.ts. Event accumulation/current-event selection and suppression: src/lib/patientQuestions/stateMachine.ts. Transactional persistence/final assembly: src/lib/patientQuestionService.ts. V7 scope/provenance constraint and base-question withholding: src/lib/patientQuestions/eligibility.ts. Active pipeline: src/app/api/conversation/route.ts.

Faculty/application discrepancies are enumerated in CONTRACT.md and REPORT.md: Case1 optional antibiotics/discharge request absent from catalog; Case3 faculty drainage/agreement sequence versus broader application temporary-treatment event; Case4 catalog question/timing absent from faculty; Case5 faculty does not prescribe exact turn timing, while existing application requires sourced substantive pain. These are policy clarification issues, not silently resolved by inventing faculty instructions. No turn-count rule was introduced.
