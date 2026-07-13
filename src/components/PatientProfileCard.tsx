"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PatientCardPresentation } from "@/lib/patientCardPresentation";
import { cn } from "@/lib/utils";

type PatientProfileCardProps = {
  presentation: PatientCardPresentation;
  className?: string;
  showPhoto?: boolean;
  showDetails?: boolean;
  compact?: boolean;
  eyebrow?: string;
  contextLabel?: string;
};

const urgencyStyles = {
  Routine: "border border-[var(--color-border)] bg-white text-[var(--color-brand)]",
  Urgent: "bg-[color-mix(in_srgb,var(--color-retry)_14%,white)] text-[var(--color-retry)]",
  Emergency:
    "bg-[color-mix(in_srgb,var(--color-emergency)_12%,white)] text-[var(--color-emergency)]",
};

export function PatientProfileCard({
  presentation,
  className,
  showPhoto = true,
  showDetails = true,
  compact = false,
  eyebrow,
  contextLabel,
}: PatientProfileCardProps) {
  const { patientCase } = presentation;

  return (
    <article
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--elevation-subtle)]",
        compact ? "p-4" : "p-6",
        className
      )}
    >
      <Link
        href={presentation.href}
        className={cn(
          "flex flex-col",
          compact
            ? eyebrow || contextLabel
              ? "min-h-[28.75rem]"
              : "min-h-[24.75rem]"
            : "min-h-[31rem]",
        )}
      >
        {eyebrow ? (
          <p className="text-sm font-semibold text-[var(--color-brand)]">
            {eyebrow}
          </p>
        ) : null}
        {contextLabel ? (
          <p className="mt-2 text-sm font-semibold text-[var(--color-action)]">
            {contextLabel}
          </p>
        ) : null}
        {showPhoto ? (
          <div
            className={cn(
              "grid place-items-center",
              compact ? "mb-5" : "mb-7",
              eyebrow || contextLabel ? "mt-4" : undefined,
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-brand)_12%,white)]",
                compact ? "size-[5.75rem]" : "size-32"
              )}
            >
              <Image
                src={patientCase.assets.rest}
                alt={`${patientCase.patientName} portrait`}
                fill
                sizes={compact ? "92px" : "128px"}
                className="object-cover"
              />
            </div>
          </div>
        ) : null}

        <div>
          <h2
            className={cn(
              "font-semibold leading-none tracking-tight",
              compact ? "text-3xl" : "text-4xl"
            )}
          >
            {patientCase.patientName}
          </h2>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            {presentation.caseLabel}
          </p>
        </div>

        <blockquote
          className={cn(
            "font-semibold leading-tight text-[var(--color-text-primary)]",
            compact ? "mt-4 text-xl" : "mt-8 text-2xl"
          )}
        >
          &ldquo;{presentation.openingStatement}&rdquo;
        </blockquote>

        {showDetails ? (
          <p
            className={cn(
              "text-[var(--color-text-secondary)]",
              compact ? "mt-3 text-sm leading-6" : "mt-4 text-base leading-7"
            )}
          >
            Prepare for a focused consultation and decide what to ask next.
          </p>
        ) : null}

        <div className={cn("flex items-center justify-between gap-3", compact ? "mt-4" : "mt-8")}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold",
                urgencyStyles[presentation.urgency]
              )}
            >
              {presentation.urgency}
            </span>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--color-action)_12%,white)] px-4 py-2 text-sm font-semibold text-[var(--color-action)]">
              {presentation.statusLabel}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
            <Clock className="size-4" />
            {presentation.duration}
          </span>
        </div>

        {presentation.lastUpdated ? (
          <p className="mt-3 text-xs font-semibold text-[var(--color-text-secondary)]">
            Last updated {formatSavedAt(presentation.lastUpdated)}
          </p>
        ) : null}

        <Button
          asChild
          size="lg"
          className={cn(
            "w-full rounded-xl bg-[var(--color-action)] text-base font-semibold text-white hover:bg-[color-mix(in_srgb,var(--color-action)_88%,black)]",
            "mt-auto",
            compact ? "h-12" : "h-14"
          )}
        >
          <span>{presentation.actionLabel}</span>
        </Button>
      </Link>
    </article>
  );
}

function formatSavedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
