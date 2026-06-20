"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  USER_ROLES,
} from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { copyTextToClipboard } from "@/lib/utils";
import type { User, UserRole } from "@/types";

interface UserForm {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

const emptyForm: UserForm = { name: "", email: "", role: "accountant", password: "" };

function InviteCodesCard() {
  const [invites, setInvites] = useState<
    Array<{
      id: string;
      token: string;
      email: string;
      role: string;
      expires_at: string;
    }>
  >([]);
  const [pending, setPending] = useState<
    Array<{ id: string; userId: string; name: string; email: string; role: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"accountant" | "hr">("accountant");

  const loadInvites = async () => {
    setLoading(true);
    try {
      const [invitesRes, pendingRes] = await Promise.all([
        fetch("/api/invites", { credentials: "include" }),
        fetch("/api/admin/pending-members", { credentials: "include" }),
      ]);
      const invitesJson = await invitesRes.json();
      const pendingJson = await pendingRes.json();
      if (invitesJson.success) setInvites(invitesJson.data ?? []);
      if (pendingJson.success) setPending(pendingJson.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvites();
  }, []);

  const handleGenerate = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required for invites");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          expiresInDays: 7,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed");
      toast.success("Invite generated");
      setInviteEmail("");
      await loadInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate invite");
    } finally {
      setGenerating(false);
    }
  };

  const revokeInvite = async (id: string) => {
    const res = await fetch(`/api/invites?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Failed to revoke invite");
      return;
    }
    toast.success("Invite revoked");
    await loadInvites();
  };

  const approvePending = async (userId: string) => {
    const res = await fetch("/api/admin/pending-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Failed to approve");
      return;
    }
    toast.success("Member approved");
    await loadInvites();
  };

  const rejectPending = async (userId: string) => {
    const res = await fetch(`/api/admin/pending-members?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Failed to reject");
      return;
    }
    toast.success("Pending request rejected");
    await loadInvites();
  };

  const copyInvite = async (token: string) => {
    const link = `${window.location.origin}/signup?invite=${token}`;
    const copied = await copyTextToClipboard(link);
    if (copied) {
      toast.success("Invite link copied");
    } else {
      toast.error("Could not copy — select and copy the code manually");
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Email-specific invites</h3>
            <p className="text-sm text-muted-foreground">
              Invites are tied to one email address and expire after 7 days.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="team.member@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="max-w-xs"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "accountant" | "hr")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accountant">Accountant</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating..." : "Generate invite"}
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading invites...</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active invite codes.</p>
          ) : (
            <div className="space-y-2">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="font-mono text-xs break-all">{inv.token}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyInvite(inv.token)}>
                      Copy link
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => void revokeInvite(inv.id)}>
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t pt-6">
          <h3 className="font-medium">Pending approval requests</h3>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending self-join requests.</p>
          ) : (
            pending.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void approvePending(member.userId)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void rejectPending(member.userId)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function UsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const refresh = async () => {
    setLoading(true);
    setUsers(await getUsers());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [session?.companyId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, role: user.role, password: "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!session || !form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    try {
      if (editing) {
        await updateUser(
          editing.id,
          {
            name: form.name,
            email: form.email,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          },
          session.userId,
          session.name
        );
        toast.success("User updated");
      } else {
        if (!form.password) {
          toast.error("Password is required for new users");
          return;
        }
        await createUser(form, session.userId, session.name);
        toast.success("User created");
      }
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user");
    }
  };

  const handleDelete = async () => {
    if (!session || !deleting) return;
    try {
      await deleteUser(deleting.id, session.userId, session.name);
      toast.success("User removed from company");
      setDeleteOpen(false);
      setDeleting(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  return (
    <RoleGate roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader title="Users" description="Manage platform users and roles">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </PageHeader>

        <InviteCodesCard />

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading users...</p>
            ) : users.length === 0 ? (
              <EmptyState
                icon="users"
                title="No users yet"
                description="Add your first platform user to get started."
                action={<Button onClick={openCreate}>Add User</Button>}
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                          </TableCell>
                          <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setDeleting(user); setDeleteOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-lg border p-4">
                      <div className="flex justify-between">
                        <span className="font-medium">{user.name}</span>
                        <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="mt-2 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(user)}>Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => { setDeleting(user); setDeleteOpen(true); }}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
              <DialogDescription>
                {editing ? "Update user details and role." : "Create a new platform user."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{editing ? "New Password (optional)" : "Password"}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove User</DialogTitle>
              <DialogDescription>
                Remove {deleting?.name} from this company? Their account will remain but lose access here.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}
