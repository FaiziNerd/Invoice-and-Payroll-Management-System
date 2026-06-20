import { getFromStorage, setInStorage } from "./storage";
import type { Client } from "@/types";
import { generateId } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";

const KEY = "clients";

export function getClients(): Client[] {
  return getFromStorage<Client[]>(KEY, []);
}

export function getClientById(id: string): Client | undefined {
  return getClients().find((c) => c.id === id);
}

export function createClient(
  data: Omit<Client, "id" | "createdAt">,
  userId: string,
  userName: string
): Client {
  const client: Client = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  const clients = getClients();
  clients.push(client);
  setInStorage(KEY, clients);
  addAuditLog({
    action: "create",
    entity: "client",
    entityId: client.id,
    userId,
    userName,
    description: `Created client ${client.name}`,
  });
  return client;
}

export function updateClient(
  id: string,
  data: Partial<Omit<Client, "id" | "createdAt">>,
  userId: string,
  userName: string
): Client | null {
  const clients = getClients();
  const index = clients.findIndex((c) => c.id === id);
  if (index === -1) return null;
  clients[index] = { ...clients[index], ...data };
  setInStorage(KEY, clients);
  addAuditLog({
    action: "update",
    entity: "client",
    entityId: id,
    userId,
    userName,
    description: `Updated client ${clients[index].name}`,
  });
  return clients[index];
}

export function deleteClient(
  id: string,
  userId: string,
  userName: string
): boolean {
  const clients = getClients();
  const client = clients.find((c) => c.id === id);
  if (!client) return false;
  setInStorage(
    KEY,
    clients.filter((c) => c.id !== id)
  );
  addAuditLog({
    action: "delete",
    entity: "client",
    entityId: id,
    userId,
    userName,
    description: `Deleted client ${client.name}`,
  });
  return true;
}
