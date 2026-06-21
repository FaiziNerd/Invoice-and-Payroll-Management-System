"use client";

import { Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CompanySwitcher } from "@/components/layout/company-switcher";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { session, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/80 bg-card/80 px-4 backdrop-blur-md md:px-6">
      <div className="ml-10 flex min-w-0 items-center gap-3 md:ml-0">
        <div className="min-w-0">
          <p className="text-label text-muted-foreground">Welcome back</p>
          <p className="truncate font-semibold tracking-tight">{session?.name}</p>
        </div>
        <CompanySwitcher />
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="capitalize hidden sm:inline-flex">
          {session?.role}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>
    </header>
  );
}
