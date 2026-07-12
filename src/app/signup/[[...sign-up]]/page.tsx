import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

export default function SignupPage() {
  return (
    <main className="min-h-dvh bg-[var(--color-background)] px-4 py-8 text-[var(--color-text-primary)]">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[26rem] flex-col justify-center">
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

        <div className="flex justify-center">
          <SignUp
            path="/signup"
            routing="path"
            signInUrl="/login"
            fallbackRedirectUrl="/home"
          />
        </div>
      </section>
    </main>
  );
}
