export type PatientDialogueFormattingCategory =
  | "heading"
  | "bullet-list"
  | "numbered-list"
  | "emphasis"
  | "code"
  | "label"
  | "outer-quotes"
  | "spacing";

export type PatientDialogueNormalizationResult = {
  text: string;
  changed: boolean;
  categories: PatientDialogueFormattingCategory[];
};

const BULLET_PREFIX = /^\s*[-*•⦁]\s+/;
const NUMBERED_LIST_PREFIX = /^\s*\d+[.)]\s+/;
const RESPONSE_LABEL = /^\s*(?:patient|response|answer)\s*:\s*/i;
const HEADING = /^\s{0,3}#{1,6}\s*(.*?)\s*$/;

export function normalizePatientDialogue(text: string): string {
  return normalizePatientDialogueWithDiagnostics(text).text;
}

const OUTER_QUOTE_PAIRS = new Map<string, string>([
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
]);

export function normalizeOuterPatientQuoteWrapper(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 2) return trimmed;
  const expectedClosingQuote = OUTER_QUOTE_PAIRS.get(trimmed[0]);
  if (!expectedClosingQuote || trimmed.at(-1) !== expectedClosingQuote) {
    return trimmed;
  }
  return trimmed.slice(1, -1).trim();
}

export function normalizePatientDialogueWithDiagnostics(
  text: string,
): PatientDialogueNormalizationResult {
  const categories = new Set<PatientDialogueFormattingCategory>();
  const normalizedNewlines = text.replace(/\r\n?/g, "\n");
  const sourceLines = normalizedNewlines.split("\n");
  const lines: string[] = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    let line = sourceLines[index];

    if (/^\s*```/.test(line)) {
      categories.add("code");
      continue;
    }

    const headingMatch = line.match(HEADING);
    if (headingMatch) {
      categories.add("heading");
      const headingText = headingMatch[1].trim();
      const nextContentLine = sourceLines
        .slice(index + 1)
        .find((candidate) => candidate.trim());

      if (
        headingText &&
        !/[.!?]$/.test(headingText) &&
        nextContentLine &&
        (BULLET_PREFIX.test(nextContentLine) ||
          NUMBERED_LIST_PREFIX.test(nextContentLine))
      ) {
        continue;
      }

      line = headingText;
    }

    if (RESPONSE_LABEL.test(line)) {
      categories.add("label");
      line = line.replace(RESPONSE_LABEL, "");
    }

    if (NUMBERED_LIST_PREFIX.test(line)) {
      categories.add("numbered-list");
      line = line.replace(NUMBERED_LIST_PREFIX, "");
    } else if (BULLET_PREFIX.test(line)) {
      categories.add("bullet-list");
      line = line.replace(BULLET_PREFIX, "");
    }

    if (/`/.test(line)) {
      categories.add("code");
      line = line.replace(/`+/g, "");
    }

    if (/\*|__|_[^_\n]+_/.test(line)) {
      categories.add("emphasis");
      line = line
        .replace(/\*\*([^*\n]+)\*\*/g, "$1")
        .replace(/__([^_\n]+)__/g, "$1")
        .replace(/\*([^*\n]+)\*/g, "$1")
        .replace(/_([^_\n]+)_/g, "$1")
        .replace(/\*+/g, "");
    }

    const compactLine = line.trim().replace(/[\t ]{2,}/g, " ");
    if (compactLine !== line) {
      categories.add("spacing");
    }
    lines.push(compactLine);
  }

  const paragraphs = lines
    .join("\n")
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.split("\n").filter(Boolean).join(" ").trim())
    .filter(Boolean);
  const dialogue = paragraphs.join("\n\n");
  const normalized = normalizeOuterPatientQuoteWrapper(dialogue);
  if (normalized !== dialogue) categories.add("outer-quotes");

  if (normalizedNewlines.trim() !== normalized) {
    if (/\n{3,}|^\s|\s$/.test(normalizedNewlines)) {
      categories.add("spacing");
    }
  }

  if (text !== normalized && categories.size === 0) {
    categories.add("spacing");
  }

  return {
    text: normalized,
    changed: text !== normalized,
    categories: [...categories],
  };
}
