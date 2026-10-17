export const FACT_CATEGORIES = [
  "chief-complaint", "onset", "location", "duration", "quality", "severity",
  "aggravating", "relieving", "timing", "radiation", "spontaneous-pain",
  "nocturnal-pain", "thermal", "lingering", "biting", "swelling", "drainage",
  "fever", "systemic", "airway", "medical-history", "medication", "allergy",
  "social-history", "dental-history", "examination", "vital-sign", "laboratory",
  "imaging", "diagnosis", "management", "patient-goal", "access-barrier",
] as const;

export const DISCLOSURE_REQUIREMENTS = [
  "opening-only", "broad-question", "targeted-question", "targeted-follow-up",
  "examination-only", "diagnostic-viewer-only", "clinician-inference-only",
  "patient-does-not-know", "not-disclosable-by-patient",
] as const;

export const PRECISIONS = [
  "exact", "qualitative", "approximate", "no-exact-value", "not-specified",
] as const;

export const FACT_SOURCES = [
  "word-body", "word-comment", "audit-interpretation", "implementation-metadata",
] as const;

export type CanonicalFact = {
  id: string;
  statement: string;
  category: (typeof FACT_CATEGORIES)[number];
  value: string | number | boolean;
  precision: (typeof PRECISIONS)[number];
  polarity: "positive" | "negative" | "not-specified";
  source: (typeof FACT_SOURCES)[number];
  patientKnowledge: "known" | "unknown" | "not-applicable";
  disclosureRequirement: (typeof DISCLOSURE_REQUIREMENTS)[number];
  rubricRequired: boolean;
  facultyConfirmationPending: boolean;
  implementationMatchers?: string[];
  unsupportedImplementationMatchers?: string[];
  questions?: string[];
};

export type CanonicalCaseSpec = {
  schemaVersion: 1;
  identity: {
    caseId: `case-0${1 | 2 | 3 | 4 | 5}`;
    age: number;
    setting: string;
    location: string;
    displayName: string;
    displayNameStatus: "canonical" | "implementation-metadata";
    gender: { status: "canonically-specified" | "implementation-metadata" | "not-specified"; value?: string };
  };
  sources: { wordDocument: string; auditDocument: "docs/case-spec-audit.md" };
  facts: CanonicalFact[];
  facultyReview: Array<{ id: string; question: string; status: "pending" }>;
};

export function defineCanonicalCase<T extends CanonicalCaseSpec>(fixture: T): T {
  return fixture;
}
