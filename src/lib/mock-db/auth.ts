import { getFromStorage, setInStorage } from "./storage";
import type { User, Session } from "@/types";

const USERS_KEY = "users";
const SESSION_KEY = "session";
const SESSION_COOKIE = "ipms_session";

export const DEMO_USERS: User[] = [
  {
    id: "user-admin",
    name: "Admin User",
    email: "admin@dotcode.com",
    role: "admin",
    password: "admin123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-accountant",
    name: "Sarah Accountant",
    email: "accountant@dotcode.com",
    role: "accountant",
    password: "acc123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "user-hr",
    name: "James HR",
    email: "hr@dotcode.com",
    role: "hr",
    password: "hr123",
    createdAt: new Date().toISOString(),
  },
];

export function getUsers(): User[] {
  return getFromStorage<User[]>(USERS_KEY, DEMO_USERS);
}

export function getSession(): Session | null {
  return getFromStorage<Session | null>(SESSION_KEY, null);
}

export function setSession(session: Session | null): void {
  setInStorage(SESSION_KEY, session);
  if (typeof document !== "undefined") {
    if (session) {
      document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`;
    } else {
      document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
    }
  }
}

export function login(email: string, password: string): Session | null {
  const user = getUsers().find(
    (u) => u.email === email && u.password === password
  );
  if (!user) return null;
  const session: Session = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  setSession(session);
  return session;
}

export function logout(): void {
  setSession(null);
}

export function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes(`${SESSION_COOKIE}=1`);
}
