"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, UserRole } from "@/types";
import {
  getSession,
  login as authLogin,
  logout as authLogout,
} from "@/lib/mock-db/auth";
import { addAuditLog } from "@/lib/audit";
import { initializeSeedData } from "@/data/seed";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeSeedData();
    setSession(getSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = authLogin(email, password);
    if (result) {
      setSession(result);
      addAuditLog({
        action: "login",
        entity: "user",
        entityId: result.userId,
        userId: result.userId,
        userName: result.name,
        description: `${result.name} logged in`,
      });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    if (session) {
      addAuditLog({
        action: "logout",
        entity: "user",
        entityId: session.userId,
        userId: session.userId,
        userName: session.name,
        description: `${session.name} logged out`,
      });
    }
    authLogout();
    setSession(null);
  }, [session]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!session) return false;
      return roles.includes(session.role);
    },
    [session]
  );

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
