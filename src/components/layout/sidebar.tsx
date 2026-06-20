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
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "accountant", "hr"] },
  { label: "Invoices", href: "/invoices", icon: FileText, roles: ["admin", "accountant"] },
  { label: "Clients", href: "/clients", icon: Users, roles: ["admin", "accountant"] },
  { label: "Designer", href: "/designer", icon: Palette, roles: ["admin", "accountant"] },
  { label: "Employees", href: "/employees", icon: UserCircle, roles: ["admin", "hr"] },
  { label: "Departments", href: "/departments", icon: Building2, roles: ["admin", "hr"] },
  { label: "Payroll", href: "/payroll", icon: Wallet, roles: ["admin", "accountant", "hr"] },
  { label: "Salary Slips", href: "/salary-slips", icon: Receipt, roles: ["admin", "hr"] },
  { label: "Users", href: "/admin/users", icon: Shield, roles: ["admin"] },
  { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["admin"] },
  { label: "Activity", href: "/admin/activity", icon: Activity, roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filtered = navItems.filter((item) => hasRole(...item.roles));

  const NavContent = () => (
    <nav className="flex flex-col gap-1 p-4">
      {filtered.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs">
              IP
            </div>
            <span>DotCode IPMS</span>
          </Link>
        </div>
        <NavContent />
      </aside>
    </>
  );
}
