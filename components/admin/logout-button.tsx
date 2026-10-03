"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoutIcon } from "@/components/icons";

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={isLoggingOut}
      className={`flex items-center gap-2 rounded-full border border-[#e5d7d1] bg-white/60 px-4 py-2 text-sm font-medium text-[#4a4442] transition hover:bg-[#f2e7df] disabled:opacity-60 ${className}`}
    >
      <LogoutIcon className="h-4 w-4" />
      {isLoggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}
    </button>
  );
}
