"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Users,
  Palette,
  UserCircle,
  Building2,
  Wallet,
  Receipt,
  Moon,
  Smartphone,
  Download,
  QrCode,
  Activity,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "next-themes";
import { APP_NAME } from "@/lib/branding";

const modules = [
  { icon: FileText, title: "Invoicing", description: "Create, send, and track professional invoices with PDF export and share links." },
  { icon: Users, title: "Clients", description: "Manage client records, contact details, and billing relationships." },
  { icon: Palette, title: "Designer", description: "Customize invoice templates with branding, colors, and layout themes." },
  { icon: UserCircle, title: "Employees", description: "Maintain employee profiles, salary structures, and employment history." },
  { icon: Building2, title: "Departments", description: "Organize teams and departments across your organization." },
  { icon: Wallet, title: "Payroll", description: "Run monthly payroll with adjustments, processing, and payment tracking." },
  { icon: Receipt, title: "Salary Slips", description: "Generate and download branded salary slips for every payroll run." },
];

const bonusFeatures = [
  { icon: Moon, label: "Dark Mode" },
  { icon: Smartphone, label: "Mobile Responsive" },
  { icon: Download, label: "CSV Export" },
  { icon: QrCode, label: "QR Codes" },
  { icon: Activity, label: "Audit Logs" },
  { icon: Sparkles, label: "Smart Summary" },
];

const painPoints = [
  "Manual spreadsheets for invoices and payroll",
  "No unified view of revenue vs. payroll costs",
  "Time-consuming salary slip generation",
  "Scattered client and employee records",
];

const solutions = [
  "Automated invoice lifecycle from draft to paid",
  "Real-time dashboard with financial analytics",
  "One-click payroll runs and salary slip PDFs",
  "Role-based access for admin, HR, and accounting",
];

export default function LandingPage() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!isLoading && session) {
      router.replace("/dashboard");
    }
  }, [session, isLoading, router]);

  if (isLoading || session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-brand">
            <div className="logo-mark h-8 w-8 text-xs font-semibold">
              IP
            </div>
            <span>{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Moon className="h-4 w-4" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="hero-glow mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl space-y-6">
          <p className="text-label text-primary">
            Invoice &amp; Payroll Management
          </p>
          <h1 className="text-4xl tracking-tight sm:text-5xl lg:text-6xl">
            Smart Invoice &amp; Payroll Management Platform
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Streamline your business finances with a unified platform for invoicing,
            client management, payroll processing, and real-time financial analytics —
            built for growing teams.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/login">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">View Demo</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-normal">From Chaos to Clarity</h2>
            <p className="mt-2 text-muted-foreground">
              Replace fragmented tools with one integrated financial management system.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  The Problem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {painPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  Our Solution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {solutions.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-normal">Seven Powerful Modules</h2>
            <p className="mt-2 text-muted-foreground">
              Everything you need to manage invoices and payroll in one place.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <Card key={mod.title} className="interactive-lift border-border/80">
                  <CardHeader>
                    <div className="kpi-icon mb-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-lg">{mod.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{mod.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-primary py-14 text-primary-foreground sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="mb-6 text-center text-label opacity-70">
            Bonus Features
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {bonusFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.label} className="flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-2 text-sm backdrop-blur-sm">
                  <Icon className="h-4 w-4 opacity-80" />
                  <span>{feat.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl font-normal">Ready to streamline your business?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Create your company account and start managing invoices and payroll in one place.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link href="/signup">
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-brand">
            <div className="logo-mark h-7 w-7 text-[10px] font-semibold">
              IP
            </div>
            {APP_NAME}
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
