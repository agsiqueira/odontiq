import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-[var(--color-background)] px-4 py-8 text-[var(--color-text-primary)]">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[26rem] flex-col justify-center">
        <div className="mb-12 text-center">
          <Image
            src="/odontIQ-logo.svg"
            alt="odontIQ"
            width={164}
            height={48}
            priority
            className="mx-auto h-12 w-auto"
          />
          <p className="mt-4 text-2xl font-semibold">Think Like a Dentist.</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 shadow-[var(--elevation-subtle)]">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-base leading-7 text-[var(--color-text-secondary)]">
              Continue your patient practice.
            </p>
          </div>

          <form className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Email</span>
              <input
                type="email"
                autoComplete="email"
                className="mt-2 h-14 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand)_14%,white)]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                className="mt-2 h-14 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand)_14%,white)]"
              />
            </label>

            <Button
              asChild
              size="lg"
              className="h-14 w-full rounded-xl bg-[var(--color-action)] text-base font-semibold text-white hover:bg-[color-mix(in_srgb,var(--color-action)_88%,black)]"
            >
              <Link href="/home">Sign In</Link>
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-base text-[var(--color-text-secondary)]">
          New to odontIQ?{" "}
          <Link href="/signup" className="font-semibold text-[var(--color-brand)]">
            Create Account
          </Link>
        </p>
      </section>
    </main>
  );
}
