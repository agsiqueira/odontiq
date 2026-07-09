"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Home } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/cases", label: "Cases", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),0.9rem)] pt-2">
      <div className="mx-auto grid max-w-[27rem] grid-cols-3 gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--elevation-subtle)] backdrop-blur">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-full text-xs font-semibold text-[var(--color-text-secondary)] transition-colors",
                active && "bg-[var(--color-brand)] text-white shadow-none"
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
