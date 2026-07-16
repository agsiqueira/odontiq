import type { CanonicalFact } from "./schema";

type FactInput = Pick<CanonicalFact, "id" | "statement" | "category" | "value"> &
  Partial<Omit<CanonicalFact, "id" | "statement" | "category" | "value">>;

export function fact(input: FactInput): CanonicalFact {
  return {
    precision: "qualitative",
    polarity: "positive",
    source: "word-body",
    patientKnowledge: "known",
    disclosureRequirement: "targeted-question",
    rubricRequired: false,
    facultyConfirmationPending: false,
    ...input,
  };
}
