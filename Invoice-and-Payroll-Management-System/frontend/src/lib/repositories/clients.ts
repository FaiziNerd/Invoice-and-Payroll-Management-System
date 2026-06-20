import type { Client } from "@/types";
import { addAuditLog } from "@/lib/repositories/audit";
import { notifyDataChange } from "@/lib/data/events";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

let clientsCache: Client[] = [];

async function parseApi<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResult<T>;
  if (!json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

function upsertCache(client: Client) {
  const index = clientsCache.findIndex((c) => c.id === client.id);
  if (index === -1) {
    clientsCache = [...clientsCache, client].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  } else {
    clientsCache = clientsCache.map((c) => (c.id === client.id ? client : c));
  }
}

function removeFromCache(id: string) {
  clientsCache = clientsCache.filter((c) => c.id !== id);
}

export async function loadClientsFromApi(): Promise<Client[]> {
  const res = await fetch("/api/clients", { credentials: "include" });
  if (!res.ok) {
    clientsCache = [];
    return clientsCache;
  }
  clientsCache = await parseApi<Client[]>(res);
  return clientsCache;
}

export function getClients(): Client[] {
  return clientsCache;
}

export function getClientById(id: string): Client | undefined {
  return clientsCache.find((c) => c.id === id);
}

export async function fetchClientById(id: string): Promise<Client | undefined> {
  const cached = getClientById(id);
  if (cached) return cached;

  const res = await fetch(`/api/clients/${id}`, { credentials: "include" });
  if (!res.ok) return undefined;

  const client = await parseApi<Client>(res);
  upsertCache(client);
  return client;
}

/** @deprecated Public share still uses mock invoices; resolves from cache only */
export function findClientById(id: string): Client | undefined {
  return getClientById(id);
}

export async function createClient(
  data: Omit<Client, "id" | "createdAt">,
  userId: string,
  userName: string
): Promise<Client> {
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  const client = await parseApi<Client>(res);
  upsertCache(client);
  notifyDataChange("clients");
  void addAuditLog({
    action: "create",
    entity: "client",
    entityId: client.id,
    userId,
    userName,
    description: `Created client ${client.name}`,
  });
  return client;
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, "id" | "createdAt">>,
  userId: string,
  userName: string
): Promise<Client | null> {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (res.status === 404) return null;

  const client = await parseApi<Client>(res);
  upsertCache(client);
  notifyDataChange("clients");
  void addAuditLog({
    action: "update",
    entity: "client",
    entityId: id,
    userId,
    userName,
    description: `Updated client ${client.name}`,
  });
  return client;
}

export async function deleteClient(
  id: string,
  userId: string,
  userName: string
): Promise<boolean> {
  const client = getClientById(id);

  const res = await fetch(`/api/clients/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const json = (await res.json()) as ApiResult<{ deleted: true }>;
  if (!json.success) {
    throw new Error(json.error?.message ?? "Failed to delete client");
  }

  removeFromCache(id);
  notifyDataChange("clients");
  void addAuditLog({
    action: "delete",
    entity: "client",
    entityId: id,
    userId,
    userName,
    description: `Deleted client ${client?.name ?? id}`,
  });
  return true;
}
