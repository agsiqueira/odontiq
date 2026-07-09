import Image from "next/image";
import Link from "next/link";
import { Settings } from "lucide-react";

import { BottomNavigation } from "@/components/BottomNavigation";
import { PatientProfileCard } from "@/components/PatientProfileCard";
import { Button } from "@/components/ui/button";
import { getRecommendedCase } from "@/lib/cases";

export default function HomePage() {
  const recommendation = getRecommendedCase();

  return (
    <main className="min-h-dvh bg-[var(--color-background)] px-4 pb-24 pt-4 text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-[30rem] flex-col">
        <header>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Image
                src="/odontIQ-logo.svg"
                alt="odontIQ"
                width={176}
                height={50}
                priority
                className="h-12 w-auto"
              />
            </div>
            <Button
              asChild
              variant="ghost"
              size="icon-lg"
              aria-label="Settings"
              className="rounded-full bg-[var(--color-surface)] text-[var(--color-brand)] shadow-[var(--elevation-subtle)] hover:bg-white hover:text-[var(--color-brand)]"
            >
              <Link href="/settings">
                <Settings className="size-5" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-4">
          {recommendation.message ? (
            <p className="mb-4 text-base leading-7 text-[var(--color-text-secondary)]">
              {recommendation.message}
            </p>
          ) : null}
          <PatientProfileCard
            patientCase={recommendation.patientCase}
            href={`/encounter/${recommendation.patientCase.id}`}
            compact
            showDetails={false}
            buttonLabel={
              recommendation.label === "Continue Consultation"
                ? "Continue Consultation"
                : "Start Consultation"
            }
          />
        </section>
      </div>
      <BottomNavigation />
    </main>
  );
}
