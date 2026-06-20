import type { Department } from "@/types";

export interface DepartmentRow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function rowToDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    createdAt: row.created_at,
  };
}

export function departmentFieldsToRow(fields: {
  name: string;
  description: string;
}) {
  return {
    name: fields.name,
    description: fields.description || null,
  };
}
