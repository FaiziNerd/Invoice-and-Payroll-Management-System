import type { Client } from "@/types";

export interface ClientRow {
  id: string;
  company_id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    address: row.address ?? "",
    createdAt: row.created_at,
  };
}

export function clientFieldsToRow(fields: {
  name: string;
  email: string;
  phone: string;
  address: string;
}) {
  return {
    name: fields.name,
    email: fields.email,
    phone: fields.phone || null,
    address: fields.address || null,
  };
}
