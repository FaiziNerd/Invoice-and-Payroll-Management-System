"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, UserRole } from "@/types";
import {
  getSession,
  login as authLogin,
  logout as authLogout,
  SESSION_REFRESH_EVENT,
} from "@/lib/auth/client";
import { createClient } from "@/lib/supabase/client";
import { loadAllCompanyData } from "@/lib/repositories/load-all";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const next = await getSession();
    setSession(next);
    if (next) {
      await loadAllCompanyData();
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const current = await getSession();
      if (!mounted) return;
      setSession(current);
      if (current) {
        await loadAllCompanyData();
      }
      setIsLoading(false);
    })();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const next = await getSession();
        if (mounted) setSession(next);
        if (next) await loadAllCompanyData();
      }
    });

    const onSessionRefresh = () => {
      void refreshSession();
    };
    window.addEventListener(SESSION_REFRESH_EVENT, onSessionRefresh);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener(SESSION_REFRESH_EVENT, onSessionRefresh);
    };
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authLogin(email, password);
    if (result) {
      setSession(result);
      // Session fetch sets the active-company cookie; refresh before loading data
      await refreshSession();
      void fetch("/api/auth/login-audit", { method: "POST", credentials: "include" });
      return true;
    }
    return false;
  }, [refreshSession]);

  const logout = useCallback(async () => {
    await authLogout();
    setSession(null);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!session) return false;
      return roles.includes(session.role);
    },
    [session]
  );

  return (
    <AuthContext.Provider
      value={{ session, isLoading, login, logout, hasRole, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

