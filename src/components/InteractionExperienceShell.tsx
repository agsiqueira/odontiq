"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type InteractionExperienceShellProps = {
  character: ReactNode;
  conversation: ReactNode;
  composer: ReactNode;
  bottomAction?: ReactNode;
  conversationFooter?: ReactNode;
  protectedHeightClassName?: string;
  className?: string;
  characterLayerClassName?: string;
  conversationCardClassName?: string;
  conversationViewportClassName?: string;
  composerCardClassName?: string;
};

export function InteractionExperienceShell({
  character,
  conversation,
  composer,
  bottomAction,
  conversationFooter,
  protectedHeightClassName = "h-[clamp(10rem,25dvh,13.5rem)]",
  className,
  characterLayerClassName,
  conversationCardClassName,
  conversationViewportClassName,
  composerCardClassName,
}: InteractionExperienceShellProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col gap-1 overflow-visible",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center overflow-visible bg-transparent",
          protectedHeightClassName,
          characterLayerClassName,
        )}
      >
        {character}
      </div>

      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--elevation-subtle)]",
          conversationCardClassName,
        )}
      >
        <div
          className={cn(
            "shrink-0 bg-transparent",
            protectedHeightClassName,
          )}
        />
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            conversationViewportClassName,
          )}
        >
          {conversation}
        </div>
        {conversationFooter}
      </section>

      <section
        className={cn(
          "shrink-0 rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[var(--elevation-subtle)]",
          composerCardClassName,
        )}
      >
        {composer}
      </section>

      {bottomAction}
    </div>
  );
}
