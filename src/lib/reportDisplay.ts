import type { ReportDomainSection, StructuredCaseReport } from "@/lib/reportTypes";

export const REPORT_SECTION_LABELS = {
  domainScores: "Domain Scores",
  clinicalReasoningDetails: "Clinical Reasoning Details",
  managementPlanExpectations: "Management Plan Expectations",
  transcriptAppendix: "Appendix A - Transcript",
  timelineAppendix: "Appendix B - Timeline and Examination Events",
} as const;

export const REPORT_DOMAIN_LABELS: Array<{
  id: keyof StructuredCaseReport["domains"];
  label: string;
}> = [
  { id: "communication", label: "Communication" },
  { id: "history", label: "History" },
  { id: "examination", label: "Examination" },
  { id: "reasoning", label: "Clinical Reasoning" },
  { id: "management", label: "Management" },
];

const DISPLAY_LABELS = new Map<string, string>([
  ["Opened the encounter respectfully", "Opened the encounter respectfully"],
  ["Asked what brought the patient in", "Explored the patient's main concern"],
  [
    "Asked how long symptoms have been present",
    "Clarified the duration of symptoms",
  ],
  ["Asked when symptoms started", "Clarified when symptoms began"],
  [
    "Asked about airway, breathing, swallowing, or lying flat",
    "Screened for possible airway compromise",
  ],
  [
    "Asked about fever, chills, or systemic symptoms",
    "Screened for fever, chills, or systemic illness",
  ],
  [
    "Asked about pain severity or character",
    "Characterized the patient's pain",
  ],
  [
    "Asked about home medications or pain relief tried",
    "Reviewed medications and pain relief already tried",
  ],
  ["Asked about medication allergies", "Reviewed medication allergies"],
  [
    "Asked about mouth opening limitation",
    "Assessed for limited mouth opening",
  ],
  [
    "Reviewed available examination findings",
    "Reviewed the available examination findings",
  ],
  [
    "Assesses airway, breathing, swallowing, and ability to lie flat",
    "Assessed for possible airway compromise",
  ],
  [
    "Clarifies onset, duration, progression, and severity of swelling",
    "Clarified the onset, progression, and severity of swelling",
  ],
  [
    "Asks about fever/chills and systemic illness",
    "Screened for fever, chills, and systemic illness",
  ],
  [
    "Reviews analgesic use, antibiotics, and allergies",
    "Reviewed analgesic use, antibiotic exposure, and allergies",
  ],
  [
    "Recognizes emergency referral risk for deep space infection",
    "Recognized the need for urgent escalation",
  ],
  [
    "Asked about pain with hot or cold",
    "Assessed temperature sensitivity",
  ],
  [
    "Asked about biting, chewing, or tapping pain",
    "Assessed pain with biting or chewing",
  ],
  ["Asked about swelling or spread", "Assessed swelling or spread"],
  [
    "Asked about drainage, pus, or bad taste",
    "Asked about drainage or bad taste",
  ],
  [
    "Characterizes thermal and biting symptoms",
    "Characterized thermal and biting symptoms",
  ],
  [
    "Screens for spreading infection red flags",
    "Screened for signs of spreading infection",
  ],
  [
    "Asks about swelling, drainage, and bad taste",
    "Assessed swelling, drainage, and bad taste",
  ],
  [
    "Reviews analgesics, antibiotics, and allergies",
    "Reviewed analgesics, antibiotic exposure, and allergies",
  ],
  [
    "Identifies likely acute apical abscess and urgency",
    "Recognized the likely diagnosis and urgency",
  ],
  ["Asked about food trapping", "Asked about food trapping"],
  [
    "Asked about relevant medical history",
    "Reviewed relevant medical history",
  ],
  ["Asked about social history", "Reviewed relevant social history"],
  ["Asked about gum bleeding", "Asked about gum bleeding"],
  [
    "Asked whether the tooth feels loose",
    "Asked whether the tooth felt mobile",
  ],
  [
    "Explores periodontal symptoms: bleeding, food trapping, mobility",
    "Explored periodontal symptoms such as bleeding, food trapping, and mobility",
  ],
  [
    "Identifies diabetes as a risk modifier",
    "Recognized diabetes as an important risk modifier",
  ],
  [
    "Screens for systemic/spreading infection red flags",
    "Screened for systemic or spreading infection red flags",
  ],
  [
    "Asks about smoking and oral hygiene contributors",
    "Explored smoking and oral-hygiene contributors",
  ],
  [
    "Differentiates periodontal abscess from pulpal source",
    "Differentiated periodontal from pulpal sources",
  ],
  [
    "Asked about prior dental treatment",
    "Reviewed relevant prior dental treatment",
  ],
  ["Asked about grinding or clenching", "Asked about grinding or clenching"],
  [
    "Asked about patient goals or desire to save the tooth",
    "Explored the patient's treatment goals",
  ],
  [
    "Characterizes bite-provoked pain pattern",
    "Characterized the bite-provoked pain pattern",
  ],
  [
    "Screens for infection symptoms despite routine appearance",
    "Screened for infection symptoms despite a routine appearance",
  ],
  [
    "Asks about restorations and hard-biting event",
    "Asked about restorations and hard-biting events",
  ],
  [
    "Assesses thermal and spontaneous pain",
    "Assessed thermal and spontaneous pain",
  ],
  [
    "Considers cracked tooth/occlusal trauma differential",
    "Considered cracked tooth and occlusal trauma in the differential",
  ],
  ["Asked whether pain radiates", "Asked whether the pain radiated"],
  [
    "Identifies spontaneous/nocturnal pain pattern",
    "Identified a spontaneous or nocturnal pain pattern",
  ],
  [
    "Asks thermal trigger and relief questions",
    "Asked about thermal triggers and relief",
  ],
  [
    "Screens for swelling and systemic red flags",
    "Screened for swelling and systemic red flags",
  ],
  [
    "Reviews pregnancy, medications, and allergies",
    "Reviewed pregnancy status, medications, and allergies",
  ],
  [
    "Recognizes likely irreversible pulpitis and urgent dental need",
    "Recognized the likely diagnosis and urgent dental need",
  ],
]);

export type DisplayDomainSection = ReportDomainSection & {
  displayStrengths: string[];
  displayMissedOrIncomplete: string[];
  displayCriticalMisses: string[];
  displayNarrative: string;
};

export function getDisplayDomainSection(
  section: ReportDomainSection,
): DisplayDomainSection {
  const displayCriticalMisses = uniqueDisplayItems(section.criticalMisses);
  const criticalKeys = new Set(displayCriticalMisses.map(normalizeKey));
  const displayMissedOrIncomplete = uniqueDisplayItems(
    section.missedOrIncomplete,
  )
    .filter((item) => !criticalKeys.has(normalizeKey(item)))
    .slice(0, 3);
  const deterministicStrengths = uniqueDisplayItems(section.completedCriteria);
  const aiStrengths = uniqueDisplayItems(section.strengths);
  const displayStrengths =
    deterministicStrengths.length > 0 ? deterministicStrengths : aiStrengths;

  return {
    ...section,
    displayStrengths: displayStrengths.slice(0, 2),
    displayMissedOrIncomplete,
    displayCriticalMisses,
    displayNarrative: limitCompleteSentences(section.narrative, 2),
  };
}

export function getDisplayPracticeItems(items: string[]) {
  return uniqueDisplayItems(items).slice(0, 3);
}

export function getDisplayItem(value: string) {
  const trimmed = value.trim();
  return DISPLAY_LABELS.get(trimmed) ?? trimmed;
}

export function getDisplayOverallSummary(value: string) {
  return limitCompleteSentences(value, 3);
}

export function limitCompleteSentences(value: string, maxSentences: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [
    normalized,
  ];
  return sentences.slice(0, maxSentences).join(" ").trim();
}

function uniqueDisplayItems(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  items.forEach((item) => {
    const displayItem = getDisplayItem(item);
    const key = normalizeKey(displayItem);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(displayItem);
  });

  return result;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
