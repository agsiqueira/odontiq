import type { ReactNode } from "react";

import { BottomNavigation } from "@/components/BottomNavigation";
import { TopBar } from "@/components/TopBar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  showBrand?: boolean;
  showSettings?: boolean;
  showTopBar?: boolean;
  showBottomNavigation?: boolean;
  className?: string;
};

export function AppShell({
  children,
  title,
  eyebrow,
  showBrand = true,
  showSettings = false,
  showTopBar = true,
  showBottomNavigation = true,
  className,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col bg-[var(--color-background)]">
        {showTopBar ? (
          <TopBar
            title={title}
            eyebrow={eyebrow}
            showBrand={showBrand}
            showSettings={showSettings}
          />
        ) : null}
        <main
          className={cn(
            "flex-1 px-4 pb-32 pt-4 sm:px-6",
            !showBottomNavigation && "pb-4",
            className
          )}
        >
          {children}
        </main>
        {showBottomNavigation ? <BottomNavigation /> : null}
      </div>
    </div>
  );
}
