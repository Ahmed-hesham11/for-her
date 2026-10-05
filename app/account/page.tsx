import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { LogoutButton } from "@/components/logout-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/translations";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AccountPage() {
  const t = getDictionary(await getLocale());
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = supabaseAdmin
    ? await supabaseAdmin.from("profiles").select("full_name, phone_1, phone_2, governorate, address").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-[#f8f2ee] text-[#201d1b]">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-4 py-10 md:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#7a6762]">{t.auth.accountEyebrow}</p>
            <h1 className="mt-2 brand-serif text-[3rem] leading-none text-[#1d1918]">{t.auth.myProfile}</h1>
            <p className="mt-2 text-sm text-[#625b58]">{profile?.phone_1}</p>
          </div>
          <LogoutButton className="rounded-full border border-[#e5d7d1] bg-white/60 px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#4a4442] transition hover:bg-[#f2e7df]" label={t.header.logOut} />
        </div>

        <AccountForm
          initialProfile={{
            full_name: profile?.full_name ?? "",
            phone_1: profile?.phone_1 ?? "",
            phone_2: profile?.phone_2 ?? "",
            governorate: profile?.governorate ?? "",
            address: profile?.address ?? "",
          }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
