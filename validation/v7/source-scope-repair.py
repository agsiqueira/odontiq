from pathlib import Path
p=Path('src/lib/patientBackgroundTurn.ts');s=p.read_text().replace('import type { PatientDisclosureFact }','import { PATIENT_QUESTION_CATALOG } from "./patientQuestions/catalog";\nimport type { PatientDisclosureFact }');s=s.replace('"provider_identity" | "care_coordination"','"child_condition" | "child_provider" | "provider_identity" | "care_coordination"');s=s.replace('  if (dentist) {','''  if (daughter && !shared && !careSearchOffer && /\\b(?:teeth|tooth|pain|cavities|condition|problems?|treatment|needs?)\\b/.test(q)) {
    const condition = facts.find(f => /\\bdaughter\\b/i.test(f.text) && /\\b(?:cavities|toothache|dental problems|needs? treatment|dental work)\\b/i.test(f.text));
    add("child_condition", "daughter", condition, condition ? "sourced" : "unknown", condition?.text ?? "I'm not sure about my daughter's dental condition.");
  }
  if (dentist && daughter) {
    const childProvider = facts.find(f => /\\bdaughter\\b/i.test(f.text) && /\\b(?:has|sees|attends)\\b.{0,30}\\b(?:dentist|clinic|provider)\\b/i.test(f.text));
    add("child_provider", "daughter", childProvider, childProvider ? "sourced" : "unknown", childProvider?.text ?? "I'm not sure about her dental provider.");
  }
  if (dentist && !daughter) {''');s=s.replace('  const providerIdentity = dentist &&','  const providerIdentity = dentist && !daughter &&');s=s.replace('  const s = normalize(text);\n', '''  const s = normalize(text);
  if (turn.requests.some(r => r.concept === "care_coordination")) {
    let base = text.trim();
    for (const question of PATIENT_QUESTION_CATALOG) base = base.replace(question.text, "").trim();
    if (normalize(base) !== normalize(backgroundFallback(turn))) return { valid: false, reason: "care-search acknowledgment added unsourced assertions" };
  }
''',1);s=s.replace('    case "care_coordination":','    case "child_condition": case "child_provider": return r.value === "sourced" && s.includes(normalize(r.answer));\n    case "care_coordination":');p.write_text(s)
