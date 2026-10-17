"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { removeEncounterSnapshot } from "@/lib/localEncounter";

export function RetryCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const isStartingRef = useRef(false);

  const retryCase = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
    setStartFailed(false);

    try {
      const response = await fetch("/api/encounters/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, fresh: true }),
      });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok || !isFreshEncounterResponse(payload, caseId)) {
        throw new Error("fresh_encounter_start_failed");
      }

      removeEncounterSnapshot(caseId);
      router.push(`/encounter/${caseId}`);
    } catch {
      setStartFailed(true);
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  };

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl bg-[var(--color-surface)]"
        disabled={isStarting}
        onClick={() => void retryCase()}
      >
        <RotateCcw className="size-4" />
        {isStarting ? "Starting fresh case…" : "Retry Case"}
      </Button>
      {startFailed ? (
        <p className="mt-2 max-w-64 text-xs leading-5 text-red-700" role="alert">
          A fresh encounter could not be started. Please try again.
        </p>
      ) : null}
    </div>
  );
}

function isFreshEncounterResponse(
  value: unknown,
  expectedCaseId: string,
): value is { id: string; caseId: string; status: string; fresh: true } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    id?: unknown;
    caseId?: unknown;
    status?: unknown;
    fresh?: unknown;
  };
  return (
    typeof candidate.id === "string" &&
    candidate.caseId === expectedCaseId &&
    candidate.status === "ACTIVE" &&
    candidate.fresh === true
  );
}
