"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/mock-db/departments";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import type { Department } from "@/types";

export default function DepartmentsPage() {
  const { session } = useAuth();
  const [departments, setDepartments] = useState(() => getDepartments());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const refresh = () => setDepartments(getDepartments());

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({ name: dept.name, description: dept.description });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!session || !form.name) return;
    if (editing) {
      updateDepartment(editing.id, form, session.userId, session.name);
      toast.success("Department updated");
    } else {
      createDepartment(form, session.userId, session.name);
      toast.success("Department created");
    }
    refresh();
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!session) return;
    deleteDepartment(id, session.userId, session.name);
    toast.success("Department deleted");
    refresh();
  };

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <PageHeader title="Departments" description="Manage organizational departments">
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Department</Button>
        </PageHeader>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.description}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}
