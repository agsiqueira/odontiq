import { AppShell } from "@/components/AppShell";
import { CasesCarousel } from "@/components/CasesCarousel";
import { CASES } from "@/lib/cases";

export default function CasesPage() {
  return (
    <AppShell title="Patients" showSettings className="space-y-3">
      <CasesCarousel cases={CASES} />
    </AppShell>
  );
}
