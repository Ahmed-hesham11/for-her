import Link from "next/link";
import { LogoutButton } from "@/components/admin/logout-button";
import { cairo } from "@/lib/admin/fonts";

export default function AdminUnauthorizedPage() {
  return (
    <div dir="rtl" lang="ar" className={`${cairo.className} flex min-h-screen items-center justify-center bg-[#f8f2ee] px-4 text-[#201d1b]`}>
      <div className="w-full max-w-[440px] rounded-[24px] border border-[#eadfd7] bg-[#fbf8f5] p-8 text-center shadow-[0_18px_40px_rgba(41,25,20,0.04)]">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[#8a3f34]">الوصول مقيّد</p>
        <h1 className="mt-4 brand-serif text-[2.6rem] leading-none text-[#1d1918]">غير مصرح لك</h1>
        <p className="mt-4 text-sm leading-6 text-[#625b58]">
          حسابك لا يملك صلاحية الوصول إلى لوحة التحكم. إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع أحد مشرفي المتجر.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/" className="rounded-full bg-[#1d1a19] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#332d2b]">
            العودة إلى المتجر
          </Link>
          <LogoutButton className="w-full justify-center" />
        </div>
      </div>
    </div>
  );
}
