import Image from "next/image";
import Link from "next/link";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";

type TopBarProps = {
  title?: string;
  eyebrow?: string;
  showBrand?: boolean;
  showSettings?: boolean;
};

export function TopBar({
  title,
  eyebrow,
  showBrand = true,
  showSettings = false,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 bg-[var(--color-background)]/95 px-4 pb-3 pt-4 backdrop-blur sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <Link href="/home" className="flex min-w-0 items-center gap-3">
          {showBrand ? (
            <Image
              src="/odontIQ-icon.svg"
              alt="odontIQ"
              width={44}
              height={44}
              priority
              className="size-11"
            />
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-brand)]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <p className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
                {title}
              </p>
            ) : null}
          </div>
        </Link>
        {showSettings ? (
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
        ) : null}
      </div>
    </header>
  );
}
