"use client";

import Link from "next/link";
import { useState } from "react";
import { CloseIcon, MenuIcon, UserIcon } from "@/components/icons";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import { cairo } from "@/lib/admin/fonts";

function SidebarContent({ adminName, onNavigate }: { adminName: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="px-2 pb-6 pt-1">
        <span className="brand-serif text-[1.9rem] leading-none tracking-[-0.03em] text-[#1b1817]">FOR HER</span>
        <p className="mt-1 text-[0.62rem] uppercase tracking-[0.24em] text-[#7b6c68]">لوحة تحكم المشرف</p>
      </Link>

      <div className="flex-1 overflow-y-auto px-1">
        <AdminSidebarNav onNavigate={onNavigate} />
      </div>

      <div className="mt-4 space-y-3 border-t border-[#eadfd7] px-1 pt-4">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2e7df] text-[#4a4442]">
            <UserIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#221d1b]">{adminName}</p>
            <p className="text-xs text-[#8a7c78]">مشرف</p>
          </div>
        </div>
        <LogoutButton className="w-full justify-center" />
      </div>
    </div>
  );
}

export function AdminShell({ adminName, children }: { adminName: string; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div dir="rtl" lang="ar" className={`${cairo.className} min-h-screen bg-[#f8f2ee] text-[#201d1b]`}>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-l border-[#eadfd7] bg-[#faf6f3] px-3 py-5 md:flex md:flex-col">
          <SidebarContent adminName={adminName} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#eadfd7] bg-[#f8f2ee]/95 px-4 py-3 backdrop-blur md:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e8d7d0] bg-white/60 text-[#2f2322] md:hidden"
              aria-label="فتح القائمة"
            >
              <MenuIcon className="h-4 w-4" />
            </button>
            <div className="md:hidden">
              <span className="brand-serif text-[1.5rem] leading-none text-[#1b1817]">FOR HER · الإدارة</span>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[80%] max-w-[300px] flex-col bg-[#faf6f3] px-3 py-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute left-3 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#e8d7d0] bg-white/60 text-[#2f2322]"
              aria-label="إغلاق القائمة"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            <SidebarContent adminName={adminName} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
