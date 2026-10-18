/** Necessary content checks on CURRENT provider assertions. These checks only veto
 * unsupported classifier flags; they never assert an event or select a question.
 * Scheduling dental care is not an explanation of what definitive treatment does.
 */
export function currentCase3Explanations(message: string) {
  const assertions = (message.toLowerCase().replace(/[’‘]/g, "'")
    .match(/[^.!?;]+[.!?;]?/g) ?? []).filter((clause) =>
    !clause.trim().endsWith("?") &&
    !/\b(?:if|hypothetically|might|may|could|would|whether|previously|in the past|last (?:week|month|year)|used to)\b/.test(clause));
  const temporary = assertions.some((clause) =>
    /\b(?:drain(?:age|ing)?|incision|i\s*(?:&|and)\s*d)\b/.test(clause) &&
    /\b(?:only|just|temporary|nondefinitive|non-definitive)\b|\b(?:does not|doesn't|will not|won't)\s+(?:fix|cure|treat|replace)\b|\b(?:reliev\w*|reduc\w*|releas\w*)\b.{0,35}\bpressure\b|\bdrain\w*\b.{0,25}\b(?:infection|pus)\b/.test(clause));
  const definitive = assertions.some((clause) =>
    !/\b(?:do not|don't|does not|doesn't|will not|won't|not|never)\s+(?:still\s+)?(?:need(?:ed|s)?|requir(?:e|ed|es)|recommend|necessary|essential)\b|\bno\s+(?:root[ -]canal|extraction|definitive treatment)\b/.test(clause) &&
    /\b(?:need(?:ed|s)?|requir(?:e|ed|es)|must|necessary|essential|has to|have to)\b/.test(clause) &&
    (/\b(?:root[ -]canal|endodontic|extract(?:ion|ing|ed)?|definitive (?:dental )?(?:care|treatment)|permanent (?:dental )?treatment)\b/.test(clause) ||
      /\b(?:remove|removing|removal of|pull|pulling)\b.{0,35}\btooth\b/.test(clause) ||
      /\b(?:treat|fix|address|resolve)\b.{0,35}\b(?:underlying (?:cause|problem)|source of (?:the )?infection)\b/.test(clause)));
  return { temporary, definitive };
}
