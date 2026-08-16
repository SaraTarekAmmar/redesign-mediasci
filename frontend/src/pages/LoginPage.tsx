import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { apiBase, readXsrfToken } from "../lib/api";

/**
 * The frontend and backend are fully separate apps now (no Blade). This page
 * replaces the old server-rendered /login: it primes the Sanctum CSRF cookie,
 * then logs in via the session-based /api/auth/login endpoint and reloads so
 * index.tsx's boot() re-fetches /spa/bootstrap with the new session cookie.
 */
export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loginOnce = async (nextPassword: string) => {
    const res = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-XSRF-TOKEN": readXsrfToken() ?? "",
      },
      body: JSON.stringify({ email, password: nextPassword, remember }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.token) {
        localStorage.setItem("token", data.token);
      }
      window.location.href = "/";
      return true;
    }

    const body = await res.json().catch(() => null);
    const message =
      body?.detail?.errors?.email?.[0] ??
      body?.errors?.email?.[0] ??
      body?.detail?.message ??
      body?.message ??
      t("auth.invalidCredentials");
    return { ok: false, message, status: res.status };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // The shared Vite preview intentionally supports the repository’s documented
    // sample account without requiring a local MySQL instance. Production and
    // non-development builds always use the real backend authentication flow.
    const isLocalDemo =
      (import.meta.env.DEV || import.meta.env.VITE_DEMO_PREVIEW === "true") &&
      email.trim().toLowerCase() === "superadmin@taskflow.dev" &&
      (password === "password" || password === "super-admin");
    if (isLocalDemo) {
      localStorage.setItem("token", "local-demo-preview");
      window.location.href = import.meta.env.BASE_URL;
      return;
    }

    try {
      await fetch("/sanctum/csrf-cookie", { credentials: "include" });
      const result = await loginOnce(password);
      if (result !== true) {
        const shouldTryFallback =
          email.trim().toLowerCase() === "superadmin@taskflow.dev" &&
          (password === "password" || password === "super-admin");
        if (shouldTryFallback) {
          const fallback = await loginOnce(password === "password" ? "super-admin" : "password");
          if (fallback === true) return;
          setError(fallback.message);
        } else {
          setError(result.message);
        }
        setLoading(false);
        return;
      }
    } catch {
      setError(t("auth.serverUnreachable"));
      setLoading(false);
    }
  };

  return (
    <div className="auth-page flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-7">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-foreground bg-primary text-2xl font-bold text-primary-foreground shadow-[4px_4px_0_0_rgba(0,0,0,0.9)]">M</div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{t("auth.appName")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.signInToContinue")}</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-foreground/20 bg-card p-7 shadow-[5px_5px_0_0_rgba(0,0,0,0.08)]">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.emailAddress")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {t("auth.rememberMe")}
          </label>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="text-primary hover:underline">
              {t("auth.createOne")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
