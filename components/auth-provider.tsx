"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Profile = {
  id: string;
  full_name: string;
  role: string;
};

export type SessionUser = {
  id: string;
  email: string | null;
};

type AuthContextValue = {
  user: SessionUser | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type MeResponse = {
  user: { id: string; full_name: string; email: string | null; role: string } | null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const body = (await response.json()) as MeResponse;
      if (body.user) {
        setUser({ id: body.user.id, email: body.user.email });
        setProfile({ id: body.user.id, full_name: body.user.full_name, role: body.user.role });
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    isLoading,
    isAuthenticated: Boolean(user),
    refreshProfile,
  }), [user, profile, isLoading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
