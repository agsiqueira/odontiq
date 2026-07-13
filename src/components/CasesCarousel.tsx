"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PatientProfileCard } from "@/components/PatientProfileCard";
import { Button } from "@/components/ui/button";
import type { OdontIQCase } from "@/lib/cases";
import {
  readCompletedEncounterStore,
  readEncounterSnapshots,
} from "@/lib/localEncounter";
import {
  buildPatientCardPresentation,
  type PatientCardPresentation,
} from "@/lib/patientCardPresentation";

type CasesCarouselProps = {
  cases: OdontIQCase[];
};

export function CasesCarousel({ cases }: CasesCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [presentations, setPresentations] = useState<
    Record<string, PatientCardPresentation> | null
  >(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const snapshots = readEncounterSnapshots();
      const completedStore = readCompletedEncounterStore();
      setPresentations(
        Object.fromEntries(
          cases.map((patientCase) => [
            patientCase.id,
            buildPatientCardPresentation({
              patientCase,
              snapshot: snapshots[patientCase.id],
              attempts: completedStore[patientCase.id] ?? [],
            }),
          ]),
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cases]);

  function scrollToPatient(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), cases.length - 1);
    setActiveIndex(nextIndex);
    const scroller = scrollerRef.current;
    const target = scroller?.children.item(nextIndex);

    if (target instanceof HTMLElement) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  function handleScroll() {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const width = scroller.clientWidth;
    const nextIndex = Math.round(scroller.scrollLeft / width);
    setActiveIndex(Math.min(Math.max(nextIndex, 0), cases.length - 1));
  }

  return (
    <section>
      <p className="mb-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">
        {activeIndex + 1} / {cases.length}
      </p>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cases.map((patientCase) => {
          const presentation = presentations?.[patientCase.id];
          return presentation ? (
            <PatientProfileCard
              key={patientCase.id}
              presentation={presentation}
              className="w-full shrink-0 snap-center"
              compact
              showDetails={false}
            />
          ) : (
            <div
              key={patientCase.id}
              className="h-[28.75rem] w-full shrink-0 snap-center animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            />
          );
        })}
      </div>

      <div className="mt-4 hidden justify-center gap-3 sm:flex">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Previous patient"
          disabled={activeIndex === 0}
          onClick={() => scrollToPatient(activeIndex - 1)}
          className="size-12 rounded-xl border-[var(--color-brand)] bg-[var(--color-surface)] text-[var(--color-brand)] shadow-none"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Next patient"
          disabled={activeIndex === cases.length - 1}
          onClick={() => scrollToPatient(activeIndex + 1)}
          className="size-12 rounded-xl border-[var(--color-brand)] bg-[var(--color-surface)] text-[var(--color-brand)] shadow-none"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </section>
  );
}
