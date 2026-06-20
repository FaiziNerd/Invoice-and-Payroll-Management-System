import { getFromStorage, setInStorage } from "./storage";
import type { User, Session, UserRole } from "@/types";
import { generateId } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";

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

export function getUserById(id: string): User | undefined {
  return getUsers().find((u) => u.id === id);
}

export function createUser(
  data: Omit<User, "id" | "createdAt">,
  actorId: string,
  actorName: string
): User {
  const users = getUsers();
  if (users.some((u) => u.email === data.email)) {
    throw new Error("Email already exists");
  }
  const user: User = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  setInStorage(USERS_KEY, users);
  addAuditLog({
    action: "create",
    entity: "user",
    entityId: user.id,
    userId: actorId,
    userName: actorName,
    description: `Created user ${user.name} (${user.role})`,
  });
  return user;
}

export function updateUser(
  id: string,
  data: Partial<Pick<User, "name" | "email" | "role" | "password">>,
  actorId: string,
  actorName: string
): User | null {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  if (data.email && users.some((u) => u.email === data.email && u.id !== id)) {
    throw new Error("Email already exists");
  }
  users[index] = { ...users[index], ...data };
  setInStorage(USERS_KEY, users);
  addAuditLog({
    action: "update",
    entity: "user",
    entityId: id,
    userId: actorId,
    userName: actorName,
    description: `Updated user ${users[index].name}`,
  });
  return users[index];
}

export function deleteUser(
  id: string,
  actorId: string,
  actorName: string
): boolean {
  const users = getUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return false;
  if (user.role === "admin" && users.filter((u) => u.role === "admin").length <= 1) {
    throw new Error("Cannot delete the last admin user");
  }
  const session = getSession();
  if (session?.userId === id) {
    throw new Error("Cannot delete your own account while logged in");
  }
  setInStorage(USERS_KEY, users.filter((u) => u.id !== id));
  addAuditLog({
    action: "delete",
    entity: "user",
    entityId: id,
    userId: actorId,
    userName: actorName,
    description: `Deleted user ${user.name}`,
  });
  return true;
}

export const USER_ROLES: UserRole[] = ["admin", "accountant", "hr"];
