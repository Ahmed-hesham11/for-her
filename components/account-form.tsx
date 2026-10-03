"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useLocale } from "@/components/locale-provider";

type ProfileFields = {
  full_name: string;
  phone_1: string;
  phone_2: string;
  governorate: string;
  address: string;
};

export function AccountForm({ initialProfile }: { initialProfile: ProfileFields }) {
  const { t } = useLocale();
  const [fields, setFields] = useState(initialProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const update = (key: keyof ProfileFields) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      // The session cookie (not any id in this form) is what the server
      // scopes the update to — the id never travels through the browser.
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update your profile right now.");

      setSuccess(t.auth.profileUpdated);
    } catch (updateFailure) {
      setError(updateFailure instanceof Error ? updateFailure.message : "Unable to update your profile right now.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="space-y-4 rounded-[24px] border border-[#eadfd7] bg-[#fbf8f5] p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-[#4e4442]">
          <span>{t.auth.fullName}</span>
          <input value={fields.full_name} onChange={update("full_name")} required className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 outline-none focus:border-[#c8a78f]" />
        </label>
        <label className="space-y-2 text-sm text-[#4e4442]">
          <span>{t.auth.phone1}</span>
          <input value={fields.phone_1} onChange={update("phone_1")} required className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 outline-none focus:border-[#c8a78f]" />
        </label>
        <label className="space-y-2 text-sm text-[#4e4442]">
          <span>{t.auth.phone2}</span>
          <input value={fields.phone_2} onChange={update("phone_2")} className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 outline-none focus:border-[#c8a78f]" />
        </label>
        <label className="space-y-2 text-sm text-[#4e4442]">
          <span>{t.auth.governorate}</span>
          <input value={fields.governorate} onChange={update("governorate")} required className="w-full rounded-full border border-[#e4d4cd] bg-white px-4 py-3 outline-none focus:border-[#c8a78f]" />
        </label>
      </div>

      <label className="block space-y-2 text-sm text-[#4e4442]">
        <span>{t.auth.address}</span>
        <textarea rows={3} value={fields.address} onChange={update("address")} required className="w-full rounded-[18px] border border-[#e4d4cd] bg-white px-4 py-3 outline-none focus:border-[#c8a78f]" />
      </label>

      {error ? <p className="rounded-2xl border border-[#f1c9c0] bg-[#fff5f3] px-3 py-2 text-sm text-[#7a3a32]">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-[#cbe6d5] bg-[#eefaf3] px-3 py-2 text-sm text-[#1e5b3d]">{success}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-full bg-[#1d1a19] px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#332d2b] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? t.auth.saving : t.auth.saveChanges}
      </button>
    </form>
  );
}
