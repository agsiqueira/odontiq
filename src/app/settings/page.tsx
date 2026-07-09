import { AppShell } from "@/components/AppShell";

export default function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      eyebrow="Account"
      showSettings
      className="space-y-6"
    >
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--elevation-subtle)]">
        <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
          Mock settings screen. Account, notification, and learning preferences
          can live here when the product needs them.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="font-semibold">Practice reminders</span>
          <span className="text-sm text-[var(--color-text-secondary)]">Off</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="font-semibold">Role</span>
          <span className="text-sm text-[var(--color-text-secondary)]">Student</span>
        </div>
      </section>
    </AppShell>
  );
}
