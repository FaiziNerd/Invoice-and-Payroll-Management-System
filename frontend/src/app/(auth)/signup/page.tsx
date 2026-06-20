"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { signUp } from "@/lib/auth/client";
import { slugify } from "@/lib/auth/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

function SignUpForm() {
  const searchParams = useSearchParams();
  const presetInvite = searchParams.get("invite") ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"create" | "join">(presetInvite ? "join" : "create");
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [inviteCode, setInviteCode] = useState(presetInvite);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refreshSession } = useAuth();

  useEffect(() => {
    if (presetInvite) {
      setMode("join");
      setInviteCode(presetInvite);
    }
  }, [presetInvite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await signUp({
        email,
        password,
        name,
        mode,
        companyName: mode === "create" ? companyName : undefined,
        companySlug: mode === "create" ? companySlug || slugify(companyName) : undefined,
        inviteCode: mode === "join" ? inviteCode.trim() : undefined,
      });
      if (session) {
        await refreshSession();
        toast.success("Account created!");
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
            IP
          </div>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground">Start a company or join an existing one</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign up</CardTitle>
            <CardDescription>
              Your profile is created automatically. Choose how to connect to a company.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "create" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setMode("create")}
                >
                  New company
                </Button>
                <Button
                  type="button"
                  variant={mode === "join" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setMode("join")}
                >
                  Join company
                </Button>
              </div>

              {mode === "create" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        if (!companySlug) setCompanySlug(slugify(e.target.value));
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companySlug">Company slug</Label>
                    <Input
                      id="companySlug"
                      value={companySlug}
                      onChange={(e) => setCompanySlug(slugify(e.target.value))}
                      placeholder="my-company"
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Invite code</Label>
                  <Input
                    id="inviteCode"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.trim())}
                    placeholder="Paste the invite code from your admin"
                    required
                    minLength={32}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ask your company admin for a single-use invite code. Slug-based joining is no longer supported.
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SignUpForm />
    </Suspense>
  );
}
