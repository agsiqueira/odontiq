import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const fields = [
  { label: "First name", type: "text", autoComplete: "given-name" },
  { label: "Last name", type: "text", autoComplete: "family-name" },
  { label: "Email", type: "email", autoComplete: "email" },
  { label: "Institution", type: "text", autoComplete: "organization" },
  { label: "Password", type: "password", autoComplete: "new-password" },
  { label: "Confirm password", type: "password", autoComplete: "new-password" },
];

export default function SignupPage() {
  return (
    <main className="min-h-dvh bg-[var(--color-background)] px-4 py-8 text-[var(--color-text-primary)]">
      <section className="mx-auto w-full max-w-[26rem]">
        <div className="mb-8 text-center">
          <Image
            src="/odontIQ-logo.svg"
            alt="odontIQ"
            width={164}
            height={48}
            priority
            className="mx-auto h-12 w-auto"
          />
          <p className="mt-4 text-2xl font-semibold">Create your account</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 shadow-[var(--elevation-subtle)]">
          <form className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.slice(0, 2).map((field) => (
                <label key={field.label} className="block">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {field.label}
                  </span>
                  <input
                    type={field.type}
                    autoComplete={field.autoComplete}
                    className="mt-2 h-14 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand)_14%,white)]"
                  />
                </label>
              ))}
            </div>

            {fields.slice(2, 4).map((field) => (
              <label key={field.label} className="block">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {field.label}
                </span>
                <input
                  type={field.type}
                  autoComplete={field.autoComplete}
                  className="mt-2 h-14 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand)_14%,white)]"
                />
              </label>
            ))}

            <label className="block">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Role</span>
              <select className="mt-2 h-14 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand)_14%,white)]">
                <option>Student</option>
                <option>Instructor</option>
              </select>
            </label>

            {fields.slice(4).map((field) => (
              <label key={field.label} className="block">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {field.label}
                </span>
                <input
                  type={field.type}
                  autoComplete={field.autoComplete}
                  className="mt-2 h-14 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand)_14%,white)]"
                />
              </label>
            ))}

            <Button
              asChild
              size="lg"
              className="h-14 w-full rounded-xl bg-[var(--color-action)] text-base font-semibold text-white hover:bg-[color-mix(in_srgb,var(--color-action)_88%,black)]"
            >
              <Link href="/home">Create Account</Link>
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-base text-[var(--color-text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--color-brand)]">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
