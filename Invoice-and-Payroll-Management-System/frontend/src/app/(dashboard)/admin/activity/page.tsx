"use client";

import { useState, useMemo } from "react";
import { Download, Search } from "lucide-react";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getAuditLogs } from "@/lib/audit";
import { exportToCSV } from "@/lib/csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import type { AuditAction } from "@/types";

const PAGE_SIZE = 20;
const ACTIONS: AuditAction[] = ["create", "update", "delete", "login", "logout", "send", "process", "export", "status_change"];
const ENTITIES = ["user", "invoice", "client", "employee", "payroll", "salary_slip", "template", "department", "dashboard"];

function formatEntityLabel(entity: string): string {
  if (entity === "salary_slip") return "Salary Slip";
  return entity.replace("_", " ");
}

export default function ActivityPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(1);

  const allLogs = useMemo(() => getAuditLogs(), []);

  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      const matchesSearch =
        log.description.toLowerCase().includes(search.toLowerCase()) ||
        log.userName.toLowerCase().includes(search.toLowerCase());
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const matchesEntity = entityFilter === "all" || log.entity === entityFilter;
      return matchesSearch && matchesAction && matchesEntity;
    });
  }, [allLogs, search, actionFilter, entityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    exportToCSV(
      filtered.map((log) => ({
        timestamp: new Date(log.timestamp).toLocaleString(),
        user: log.userName,
        action: log.action,
        entity: log.entity,
        description: log.description,
      })),
      [
        { key: "timestamp", label: "Timestamp" },
        { key: "user", label: "User" },
        { key: "action", label: "Action" },
        { key: "entity", label: "Entity" },
        { key: "description", label: "Description" },
      ],
      "activity-log.csv"
    );
    toast.success("Activity log exported");
  };

  return (
    <RoleGate roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader title="Activity Log" description="Audit trail of all platform actions">
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </PageHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a} className="capitalize">{a.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {ENTITIES.map((e) => (
                <SelectItem key={e} value={e}>{formatEntityLabel(e)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="pt-6">
            {allLogs.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No activity yet"
                description="Actions across the platform will appear here."
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No matching activity"
                description="Try adjusting your search or filter criteria."
              />
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
                      {paginated.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>{log.userName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{log.action.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell>{formatEntityLabel(log.entity)}</TableCell>
                          <TableCell>{log.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {paginated.map((log) => (
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
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages} ({filtered.length} entries)
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
