"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Palette,
  UserCircle,
  Building2,
  Wallet,
  Receipt,
  Shield,
  Activity,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/types";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/branding";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Finance",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "accountant", "hr"] },
      { label: "Invoices", href: "/invoices", icon: FileText, roles: ["admin", "accountant"] },
      { label: "Clients", href: "/clients", icon: Users, roles: ["admin", "accountant"] },
    ],
  },
  {
    label: "HR",
    items: [
      { label: "Employees", href: "/employees", icon: UserCircle, roles: ["admin", "hr"] },
      { label: "Departments", href: "/departments", icon: Building2, roles: ["admin", "hr"] },
      { label: "Payroll", href: "/payroll", icon: Wallet, roles: ["admin", "accountant", "hr"] },
      { label: "Salary Slips", href: "/salary-slips", icon: Receipt, roles: ["admin", "hr"] },
    ],
  },
  {
    label: "Design",
    items: [
      { label: "Templates", href: "/designer", icon: Palette, roles: ["admin", "accountant"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Users", href: "/admin/users", icon: Shield, roles: ["admin"] },
      { label: "Activity", href: "/admin/activity", icon: Activity, roles: ["admin"] },
      { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["admin"] },
    ],
  },
  {
    label: "Self Service",
    items: [
      { label: "My Portal", href: "/portal", icon: UserCircle, roles: ["employee"] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasRole(...item.roles)),
    }))
    .filter((group) => group.items.length > 0);

  const NavContent = () => (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="flex flex-col gap-1 p-4"
    >
      {visibleGroups.map((group, groupIndex) => (
        <div key={group.label}>
          {groupIndex > 0 && <Separator className="my-3" />}
          <p className="mb-1 px-3 text-label text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-brand">
            <div className="logo-mark h-8 w-8 text-xs font-semibold">
              IP
            </div>
            <span>{APP_NAME}</span>
          </Link>
        </div>
        <NavContent />
      </aside>
    </>
  );
}
