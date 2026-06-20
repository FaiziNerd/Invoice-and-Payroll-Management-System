import type { Department } from "@/types";
import { addAuditLog } from "@/lib/audit";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/fetch";
import { notifyDataChange } from "@/lib/data/events";

let departmentsCache: Department[] = [];

function upsertCache(department: Department): void {
  const index = departmentsCache.findIndex((d) => d.id === department.id);
  if (index === -1) {
    departmentsCache = [...departmentsCache, department].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return;
  }
  departmentsCache = departmentsCache.map((d) =>
    d.id === department.id ? department : d
  );
}

function removeFromCache(id: string): void {
  departmentsCache = departmentsCache.filter((d) => d.id !== id);
}

export async function loadDepartmentsFromApi(): Promise<Department[]> {
  try {
    departmentsCache = await apiGet<Department[]>("/api/departments");
    return departmentsCache;
  } catch {
    departmentsCache = [];
    return departmentsCache;
  }
}

export function getDepartments(): Department[] {
  return departmentsCache;
}

export function getDepartmentById(id: string): Department | undefined {
  return departmentsCache.find((d) => d.id === id);
}

export async function createDepartment(
  data: Omit<Department, "id" | "createdAt">,
  userId: string,
  userName: string
): Promise<Department> {
  const department = await apiPost<Department>("/api/departments", data);
  upsertCache(department);
  notifyDataChange("departments");

  addAuditLog({
    action: "create",
    entity: "department",
    entityId: department.id,
    userId,
    userName,
    description: `Created department ${department.name}`,
  });

  return department;
}

export async function updateDepartment(
  id: string,
  data: Partial<Omit<Department, "id" | "createdAt">>,
  userId: string,
  userName: string
): Promise<Department | null> {
  try {
    const department = await apiPatch<Department>(`/api/departments/${id}`, data);
    upsertCache(department);
    notifyDataChange("departments");

    addAuditLog({
      action: "update",
      entity: "department",
      entityId: id,
      userId,
      userName,
      description: `Updated department ${department.name}`,
    });

    return department;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return null;
    }
    throw error;
  }
}

export async function deleteDepartment(
  id: string,
  userId: string,
  userName: string
): Promise<boolean> {
  const existing = getDepartmentById(id);
  await apiDelete<{ deleted: true }>(`/api/departments/${id}`);
  removeFromCache(id);
  notifyDataChange("departments");

  addAuditLog({
    action: "delete",
    entity: "department",
    entityId: id,
    userId,
    userName,
    description: `Deleted department ${existing?.name ?? id}`,
  });

  return true;
}
