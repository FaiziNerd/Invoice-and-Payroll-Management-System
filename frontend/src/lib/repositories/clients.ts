import type { Client } from "@/types";
import { notifyDataChange } from "@/lib/data/events";
import type { PaginatedResponse } from "@/lib/api/pagination";

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

async function fetchAllActiveClients(): Promise<Client[]> {
  const all: Client[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/clients?${params.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) break;
    const pageData = await parseApi<PaginatedResponse<Client>>(res);
    all.push(...pageData.items);
    if (!pageData.hasMore || !pageData.nextCursor) break;
    cursor = pageData.nextCursor;
  }

  return all.sort((a, b) => a.name.localeCompare(b.name));
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
  try {
    clientsCache = await fetchAllActiveClients();
    notifyDataChange("clients");
  } catch {
    clientsCache = [];
  }
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

export async function createClient(
  data: Omit<Client, "id" | "createdAt">
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
  return client;
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, "id" | "createdAt">>
): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const client = await parseApi<Client>(res);
  upsertCache(client);
  notifyDataChange("clients");
  return client;
}

export async function deleteClient(id: string): Promise<void> {
  const res = await fetch(`/api/clients/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseApi<{ deleted: boolean }>(res);
  removeFromCache(id);
  notifyDataChange("clients");
}

export async function restoreClient(id: string): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ restore: true }),
  });
  const client = await parseApi<Client>(res);
  upsertCache(client);
  notifyDataChange("clients");
  return client;
}
