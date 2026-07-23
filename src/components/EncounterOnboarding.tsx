"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { encounterOnboardingContent } from "@/lib/encounterOnboarding";

type EncounterOnboardingProps = {
  isStarting: boolean;
  error?: string;
  onBegin: () => void;
};

export function EncounterOnboarding({
  isStarting,
  error,
  onBegin,
}: EncounterOnboardingProps) {
  return (
    <main className="min-h-dvh overflow-y-auto bg-[var(--color-background)] px-4 py-8 text-[var(--color-text-primary)] sm:py-12">
      <section
        aria-labelledby="encounter-onboarding-title"
        aria-describedby="encounter-onboarding-introduction"
        aria-busy={isStarting}
        className="mx-auto w-full max-w-2xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-9"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Virtual patient encounter
        </p>
        <h1
          id="encounter-onboarding-title"
          className="mt-2 text-3xl font-semibold tracking-tight"
        >
          {encounterOnboardingContent.title}
        </h1>
        <p
          id="encounter-onboarding-introduction"
          className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]"
        >
          {encounterOnboardingContent.introduction}
        </p>

        <ol className="mt-7 grid gap-4 sm:grid-cols-2">
          {encounterOnboardingContent.steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-[var(--color-border)] p-4"
            >
              <div className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-white"
                >
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-semibold">{step.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {step.description}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {error ? (
          <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="ghost" size="lg">
            <Link href="/cases">Back to cases</Link>
          </Button>
          <Button
            type="button"
            size="lg"
            autoFocus
            disabled={isStarting}
            onClick={onBegin}
            className="sm:min-w-44"
          >
            {isStarting ? "Starting..." : encounterOnboardingContent.startLabel}
          </Button>
        </div>
      </section>
    </main>
  );
}
