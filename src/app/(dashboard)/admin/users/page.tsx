"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/shared/page-header";
import { getUsers } from "@/lib/mock-db/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

export default function UsersPage() {
  const users = useMemo(() => getUsers(), []);

  return (
    <RoleGate roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Manage platform users and roles"
        />

        <Card>
          <CardContent className="pt-6">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
