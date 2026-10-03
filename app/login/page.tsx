"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading, refreshProfile } = useAuth();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace(searchParams.get("redirect") || "/");
    }
  }, [isAuthLoading, user, router, searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to sign in right now.");

      await refreshProfile();
      router.push(searchParams.get("redirect") || "/");
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "Unable to sign in right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || user) {
    return null;
  }

  return (
    <AuthShell eyebrow={t.auth.welcomeBack} title={t.auth.signInTitle} description={t.auth.signInDesc}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5 text-sm text-[#4e4442]">
          <span className="text-[0.72rem] uppercase tracking-[0.08em] text-[#7a6762]">{t.auth.email}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]"
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="block space-y-1.5 text-sm text-[#4e4442]">
          <span className="text-[0.72rem] uppercase tracking-[0.08em] text-[#7a6762]">{t.auth.password}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]"
            placeholder="********"
            required
          />
        </label>

        {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? t.auth.signingIn : t.auth.signInTitle}
        </button>

        <p className="text-center text-sm text-[#5e5552]">
          {t.auth.noAccount} <Link href="/register" className="font-medium text-[#1d1a19]">{t.auth.createOne}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
