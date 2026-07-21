"use client";

import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { setLocalEncounterUserScope } from "@/lib/localEncounter";

export function LocalEncounterStorageScope({
  children,
}: {
  children: ReactNode;
}) {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) return null;
  setLocalEncounterUserScope(userId ?? null);
  return children;
}
