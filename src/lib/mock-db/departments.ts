import { getFromStorage, setInStorage } from "./storage";
import type { Department } from "@/types";
import { generateId } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";

const KEY = "departments";

export function getDepartments(): Department[] {
  return getFromStorage<Department[]>(KEY, []);
}

export function getDepartmentById(id: string): Department | undefined {
  return getDepartments().find((d) => d.id === id);
}

export function createDepartment(
  data: Omit<Department, "id" | "createdAt">,
  userId: string,
  userName: string
): Department {
  const dept: Department = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  const departments = getDepartments();
  departments.push(dept);
  setInStorage(KEY, departments);
  addAuditLog({
    action: "create",
    entity: "department",
    entityId: dept.id,
    userId,
    userName,
    description: `Created department ${dept.name}`,
  });
  return dept;
}

export function updateDepartment(
  id: string,
  data: Partial<Omit<Department, "id" | "createdAt">>,
  userId: string,
  userName: string
): Department | null {
  const departments = getDepartments();
  const index = departments.findIndex((d) => d.id === id);
  if (index === -1) return null;
  departments[index] = { ...departments[index], ...data };
  setInStorage(KEY, departments);
  addAuditLog({
    action: "update",
    entity: "department",
    entityId: id,
    userId,
    userName,
    description: `Updated department ${departments[index].name}`,
  });
  return departments[index];
}

export function deleteDepartment(
  id: string,
  userId: string,
  userName: string
): boolean {
  const departments = getDepartments();
  const dept = departments.find((d) => d.id === id);
  if (!dept) return false;
  setInStorage(
    KEY,
    departments.filter((d) => d.id !== id)
  );
  addAuditLog({
    action: "delete",
    entity: "department",
    entityId: id,
    userId,
    userName,
    description: `Deleted department ${dept.name}`,
  });
  return true;
}
