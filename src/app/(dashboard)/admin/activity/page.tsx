"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/shared/page-header";
import { getAuditLogs } from "@/lib/audit";
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

export default function ActivityPage() {
  const logs = useMemo(() => getAuditLogs(), []);

  return (
    <RoleGate roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader
          title="Activity Log"
          description="Audit trail of all platform actions"
        />

        <Card>
          <CardContent className="pt-6">
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No activity recorded yet.</p>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>{log.userName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{log.action}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">{log.entity}</TableCell>
                          <TableCell>{log.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-lg border p-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{log.userName}</span>
                        <Badge variant="outline" className="capitalize">{log.action}</Badge>
                      </div>
                      <p className="text-sm mt-1">{log.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
