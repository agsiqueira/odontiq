"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { removeEncounterSnapshot } from "@/lib/localEncounter";

export function RetryCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();

  const retryCase = () => {
    removeEncounterSnapshot(caseId);
    router.push(`/encounter/${caseId}`);
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 rounded-xl bg-[var(--color-surface)]"
      onClick={retryCase}
    >
      <RotateCcw className="size-4" />
      Retry Case
    </Button>
  );
}
