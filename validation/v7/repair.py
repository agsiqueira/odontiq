from pathlib import Path
p=Path('src/lib/patientBackgroundTurn.ts');s=p.read_text();s=s.replace('"household" | "residence"','"provider_identity" | "care_coordination" | "household" | "residence"')
s=s.replace('  const requests: BackgroundRequest[] = [];', '''  // A care-search offer is an acknowledgment/preference turn, not a new history disclosure.
  const careSearchOffer = !/\\?\\s*$/.test(q) && /\\b(?:i|we)\\b.{0,35}\\b(?:look\\w*|search\\w*|explor\\w*|find\\w*)\\b.{0,45}\\b(?:care|clinic|dentist|options?)\\b/.test(q);
  const providerIdentity = dentist && /\\b(?:who|name)\\b/.test(q);
  const requests: BackgroundRequest[] = [];''')
s=s.replace('  if (attendance) {','''  if (providerIdentity) add("provider_identity", "patient", undefined, "unknown", "I'm not sure what name to give you.");
  if (careSearchOffer) {
    add("care_coordination", "patient", undefined, "acknowledgment", "Thank you for helping me find dental care.");
    if (daughter && family) add("shared_clinic", "patient", family, "same_clinic", "I'd prefer the same clinic for my daughter and me.");
  }
  if (attendance) {''')
s=s.replace('r.concept === "attendance" || r.concept === "payment_activity"','r.concept === "attendance" || r.concept === "payment_activity" || r.concept === "provider_identity"')
s=s.replace('how often|frequency|regularly|payment|paying|arrangement','how often|frequency|regularly|payment|paying|arrangement|name')
s=s.replace('  const missing = turn.requests.find', '''  if (turn.requests.some(r => r.value === "unknown") && /^(?:yes|yeah|yep|of course|certainly)\\b/.test(s) && !turn.shortAnswer) return { valid: false, reason: "unscoped affirmation of unspecified information" };
  const missing = turn.requests.find''')
s=s.replace('  switch (r.concept) {','  switch (r.concept) {\n    case "care_coordination": return /\\b(?:thank|thanks|appreciate)\\b/.test(s);\n    case "provider_identity": return false;')
p.write_text(s)
p=Path('src/lib/patientImmediateResponse.ts');s=p.read_text().replace('import { isPatientConversationClosure }','import { backgroundFallback } from "./patientBackgroundTurn";\nimport { isPatientConversationClosure }');s=s.replace('  if (disclosureState.backgroundTurn && !(caseId', '''  const background = disclosureState.backgroundTurn;
  if (background && !background.clinicalRequested && background.requests.some(r => r.value === "unknown" || r.concept === "care_coordination")) return backgroundFallback(background);
  if (disclosureState.backgroundTurn && !(caseId''');p.write_text(s)
p=Path('src/lib/patientDisclosure.ts');s=p.read_text();needle='  const normalizedQuestion = normalizeText(question);\n  if (/\\b(?:what have you taken|what did you take|pain medicine|pain medication)';insert='''  const normalizedQuestion = normalizeText(question);
  // Compose independently requested pain attributes before single-concept routing.
  const asksQuality = /\\b(?:feel like|describe.{0,25}pain|quality)\\b/.test(normalizedQuestion);
  const asksProvocation = /\\b(?:what|which).{0,35}(?:makes?|make|worsens?|aggravat|triggers?)\\b/.test(normalizedQuestion);
  if (asksQuality && asksProvocation) return facts.filter(fact => ["c5.quality", "c5.cold", "c5.chewing"].includes(fact.id));
  if (/\\b(?:what have you taken|what did you take|pain medicine|pain medication)''';assert needle in s;s=s.replace(needle,insert);p.write_text(s)
p=Path('src/lib/patientOutputGuard.ts');s=p.read_text().replace('function expressesRequiredFact(', 'export function expressesRequiredFact(');p.write_text(s)
