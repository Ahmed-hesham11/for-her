"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";

export function LogoutButton({ className = "", label }: { className?: string; label?: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const { refreshProfile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshProfile();
    router.push("/");
    router.refresh();
  };

  return (
    <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut} className={className}>
      {isLoggingOut ? t.header.loggingOut : label ?? t.header.logOut}
    </button>
  );
}
