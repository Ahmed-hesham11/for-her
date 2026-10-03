"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, refreshProfile } = useAuth();
  const { t } = useLocale();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace("/");
    }
  }, [isAuthLoading, user, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t.auth.passwordsMismatch);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t.auth.passwordTooShort);
      return;
    }
    if (!agree) {
      setError(t.auth.agreeRequired);
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      const body = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(t.auth.emailExists);
        }
        throw new Error(body.error ?? "Unable to create your account right now.");
      }

      await refreshProfile();
      router.push("/account");
    } catch (registerError) {
      const message = registerError instanceof Error ? registerError.message : "Unable to create your account right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || user) {
    return null;
  }

  return (
    <AuthShell
      eyebrow={t.auth.joinForHer}
      title={t.auth.createAccountTitle}
      description={t.auth.createAccountDesc}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5 text-sm text-[#4e4442]">
          <span className="text-[0.72rem] uppercase tracking-[0.08em] text-[#7a6762]">{t.auth.fullName}</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]"
            placeholder="Your name"
            required
          />
        </label>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm text-[#4e4442]">
            <span className="text-[0.72rem] uppercase tracking-[0.08em] text-[#7a6762]">{t.auth.password}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]"
              placeholder="********"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </label>
          <label className="block space-y-1.5 text-sm text-[#4e4442]">
            <span className="text-[0.72rem] uppercase tracking-[0.08em] text-[#7a6762]">{t.auth.confirmPassword}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#c8a78f]"
              placeholder="********"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </label>
        </div>

        <label className="flex items-start gap-3 text-sm text-[#524947]">
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} className="mt-1 h-4 w-4 accent-[#1d1a19]" />
          <span>{t.auth.agreeTerms}</span>
        </label>

        {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? t.auth.creatingAccount : t.auth.createAccountBtn}
        </button>

        <p className="text-center text-sm text-[#5e5552]">
          {t.auth.alreadyHaveAccount} <Link href="/login" className="font-medium text-[#1d1a19]">{t.auth.signInLink}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
