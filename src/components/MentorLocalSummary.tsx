"use client";

import { useEffect, useState } from "react";

import {
  LAST_ENCOUNTER_STORAGE_KEY,
  type LocalEncounterSummary,
} from "@/lib/localEncounter";
import { evaluateEncounter } from "@/lib/checklistEvaluation";

type MentorChecklistItem = {
  id: string;
  label: string;
  section: "patient" | "clinical";
};

type MentorLocalSummaryProps = {
  caseId: string;
  patientName: string;
  checklistItems: MentorChecklistItem[];
};

export function MentorLocalSummary({
  caseId,
  patientName,
  checklistItems,
}: MentorLocalSummaryProps) {
  const [summary, setSummary] = useState<LocalEncounterSummary | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const readTimer = window.setTimeout(() => {
      setSummary(readLocalEncounter(caseId));
    }, 0);

    return () => {
      window.clearTimeout(readTimer);
    };
  }, [caseId]);

  const studentQuestionCount =
    summary?.conversationHistory.filter((message) => message.role === "student")
      .length ?? 0;
  const patientResponseCount =
    summary?.conversationHistory.filter((message) => message.role === "patient")
      .length ?? 0;
  const evaluation = evaluateEncounter({
    caseId,
    coveredChecklistItems: summary?.coveredChecklistItems ?? [],
  });
  const patientChecklistItems = checklistItems.filter(
    (item) => item.section === "patient",
  );
  const clinicalChecklistItems = checklistItems.filter(
    (item) => item.section === "clinical",
  );

  return (
    <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <p className="text-sm font-semibold text-[var(--color-brand)]">
        Local encounter summary
      </p>
      <div className="mt-3 grid gap-3 text-sm leading-6 text-[var(--color-text-secondary)]">
        <p>
          <span className="font-semibold text-[var(--color-text-primary)]">
            Case:
          </span>{" "}
          {patientName}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text-primary)]">
            Student questions:
          </span>{" "}
          {studentQuestionCount}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text-primary)]">
            Patient responses:
          </span>{" "}
          {patientResponseCount}
        </p>
        <p>
          <span className="font-semibold text-[var(--color-text-primary)]">
            Examinations viewed:
          </span>{" "}
          {summary?.examinationsViewed.length
            ? summary.examinationsViewed.join(", ")
            : "None recorded"}
        </p>
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">
            Patient Checklist ({evaluation.patient.completed}/
            {evaluation.patient.total}, {evaluation.patient.score}%)
          </p>
          <ChecklistRows
            items={patientChecklistItems}
            coveredIds={summary?.coveredChecklistItems ?? []}
          />
        </div>
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">
            Clinical Checklist ({evaluation.clinical.completed}/
            {evaluation.clinical.total}, {evaluation.clinical.score}%)
          </p>
          <ChecklistRows
            items={clinicalChecklistItems}
            coveredIds={summary?.coveredChecklistItems ?? []}
          />
        </div>
        <p>
          <span className="font-semibold text-[var(--color-text-primary)]">
            Overall Score:
          </span>{" "}
          {evaluation.overall}%
        </p>
      </div>
    </div>
  );
}

function ChecklistRows({
  items,
  coveredIds,
}: {
  items: MentorChecklistItem[];
  coveredIds: string[];
}) {
  const coveredIdSet = new Set(coveredIds);

  return (
    <div className="mt-2 grid gap-1">
      {items.map((item) => {
        const isCovered = coveredIdSet.has(item.id);

        return (
          <p key={item.id}>
            <span
              className={
                isCovered
                  ? "font-semibold text-[var(--color-action)]"
                  : "font-semibold text-[var(--color-retry)]"
              }
            >
              {isCovered ? "✓" : "✗"}
            </span>{" "}
            {item.label}
          </p>
        );
      })}
    </div>
  );
}

function readLocalEncounter(caseId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const storedSummary = window.localStorage.getItem(
    LAST_ENCOUNTER_STORAGE_KEY,
  );

  if (!storedSummary) {
    return null;
  }

  try {
    const parsedSummary = JSON.parse(storedSummary) as LocalEncounterSummary;

    return parsedSummary.caseId === caseId ? parsedSummary : null;
  } catch {
    return null;
  }
}
