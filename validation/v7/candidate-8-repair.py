from pathlib import Path
p=Path('src/lib/patientCanonicalAssertions.ts');s=p.read_text(encoding='utf8');start=s.index('  const childCondition =');end=s.index('  if (!daughterHasProvider',start);s=s[:start]+r'''  const clinicalChildNouns = /\b(?:teeth|tooth\w*|fillings?|treatment|dental (?:problems|condition|work)|cavities|pain|attention|check[- ]?ups?)\b/i;
  const childCondition = originalClauses.flatMap(clause => clause.split(/,|\b(?:but|because|however)\b/i)).some(clause => {
    const c = clause.toLowerCase();
    const predicate = /\b(?:my daughter(?:'s (?:teeth|tooth))?|her (?:teeth|tooth)|she|my child|the child|we both|our teeth)\b.{0,45}?\b(needs?|has|have|is|are|hurts?)\b/i.exec(c);
    if (!predicate || !clinicalChildNouns.test(c)) return false;
    if (/^(?:we both|our teeth)\b/.test(predicate[0]) && !hasDaughter && !/\b(?:daughter|child)\b/i.test(context.latestStudentMessage ?? "")) return false;
    const prefix = c.slice(0, predicate.index);
    const scopedUnknown = /\b(?:not sure|don't know|do not know|don't remember)\b.{0,35}\b(?:if|whether|what)\s*$/.test(prefix) || /^\s*(?:if|whether)\s*$/.test(prefix);
    const tail = c.slice(predicate.index + predicate[0].length).trim();
    const valueStatement = /^(?:is|are)$/i.test(predicate[1]) && /^(?:very )?important to me\b/.test(tail);
    return !scopedUnknown && !valueStatement;
  });
  const childConditionSource = facts.some(f => /\bdaughter\b.{0,70}\b(?:has|needs?|hurts?)\b/i.test(f.text) && clinicalChildNouns.test(f.text) && !/\b(?:not specified|unknown|not sure)\b/i.test(f.text));
  if (childCondition && !childConditionSource) return reject("unsupported child dental condition");
'''+s[end:];marker='  const hasDaughter =';s=s.replace(marker,r'''  const constantKnown = facts.some(f => /\bconstant\b/i.test(f.text));
  if (constantKnown && originalClauses.flatMap(c => c.split(/\bbut\b/i)).some(clause => {
    if (/\b(?:used to|previously|before|earlier|at first)\b/i.test(clause)) return false;
    if (/\b(?:not|isn't|is not) constant\b/i.test(clause)) return true;
    const intermittent = /\b(?:comes? and goes?|on and off|intermittent)\b/i.exec(clause);
    return intermittent && !/\b(?:not|never|doesn't|does not)\b/i.test(clause.slice(Math.max(0, intermittent.index - 20), intermittent.index));
  })) return reject("unsupported intermittent current pain: source establishes constant pain");
'''+marker);p.write_text(s,encoding='utf8')
p=Path('src/lib/patientBackgroundTurn.ts');s=p.read_text(encoding='utf8').replace('condition?.text ?? "I\'m not sure about my daughter\'s dental condition."','condition?.text ?? (family ? "I\'m not sure about my daughter\'s dental condition." : "I\'m not sure about that dental condition.")');s=s.replace('  const clinicalRequested = /', '  const childOnlyClinical = requests.some(r => r.concept === "child_condition") && !/\\byour (?:own )?(?:tooth|teeth|pain|jaw|mouth|symptoms?)\\b|\\byou\\b.{0,25}\\b(?:pain|hurt\\w*|symptoms?)\\b/.test(q);\n  const clinicalRequested = !childOnlyClinical && /');p.write_text(s,encoding='utf8')
# Extract the existing required-fact fallback, preserving all previous preferred wording.
p=Path('src/app/api/conversation/route.ts');s=p.read_text(encoding='utf8');start=s.index('function patientFactFallback(');end=s.index('\nfunction shouldIncludeOpeningGreeting',start);body=s[start:end].replace('function patientFactFallback(', 'export function patientFactFallback(',1);body=body.replace('  selected.push(...residenceFallback', '''  const mappedIds = new Set(Object.keys(fallbacks));
  const sources = [...canonicalFacts, ...disclosureState.allowedThisTurn, ...disclosureState.alreadyDisclosed];
  for (const id of requiredIds) {
    if (mappedIds.has(id) || id.includes(".background-")) continue;
    const fact = sources.find(f => f.id === id);
    if (fact) selected.push(patientFactSentence(fact.text));
  }
  selected.push(...residenceFallback''');module='''import type { PatientDisclosureState } from "./patientDisclosure";
import { requiredFactsForTurn } from "./patientTurnFacts";
import { backgroundFallback } from "./patientBackgroundTurn";
import { residenceFallback } from "./patientResidence";
import { transportationFallback } from "./patientTransportation";

/** Render only turn-required source facts; never fall back to a whole history. */
export function patientFactSentence(source: string): string {
  let text = source.replace(/the patient['’]s/gi, "my");
  text = text.replace(/^the patient (\\w+)/i, (_all, verb: string) => {
    const irregular: Record<string,string> = {is:"am",has:"have",does:"do"};
    const base = irregular[verb.toLowerCase()] ?? (/ies$/.test(verb) ? verb.slice(0,-3)+"y" : /(?:ches|shes|sses|xes|zes|oes)$/.test(verb) ? verb.slice(0,-2) : /s$/.test(verb) ? verb.slice(0,-1) : verb);
    return `I ${base}`;
  }).replace(/\\bthe patient\\b/gi, "me").replace(/\\btheir\\b/gi,"my").replace(/\\bpercussion\\b/gi,"tapping").replace(/\\bspontaneously\\b/gi,"on its own");
  const discomfort = /^There is (slight|some) (.+) discomfort[.]?$/i.exec(text);
  return discomfort ? `I feel ${discomfort[1].toLowerCase()} discomfort with ${discomfort[2]}.` : text;
}

'''+body+'\n';Path('src/lib/patientFactFallback.ts').write_text(module,encoding='utf8');s=s[:start]+s[end:];s=s.replace('import { transportationFallback } from "@/lib/patientTransportation";','import { patientFactFallback } from "@/lib/patientFactFallback";').replace('import { residenceFallback } from "@/lib/patientResidence";\n','').replace('assessBackgroundAnswer, backgroundFallback, backgroundPrompt','assessBackgroundAnswer, backgroundPrompt');p.write_text(s,encoding='utf8')
