import Image from "next/image";
import Link from "next/link";
import { Settings } from "lucide-react";

import { BottomNavigation } from "@/components/BottomNavigation";
import { HomeProgressionCard } from "@/components/HomeProgressionCard";
import { Button } from "@/components/ui/button";

export default function HomePage() {
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
          <HomeProgressionCard />
        </section>
      </div>
      <BottomNavigation />
    </main>
  );
}
