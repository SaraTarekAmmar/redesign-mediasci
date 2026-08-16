import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { apiBase, readXsrfToken } from "../lib/api";

export default function RegisterPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirmation) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    setLoading(true);
    try {
      await fetch("/sanctum/csrf-cookie", { credentials: "include" });
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-XSRF-TOKEN": readXsrfToken() ?? "",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const firstError = body?.errors ? (Object.values(body.errors)[0] as string[])?.[0] : null;
        setError(firstError ?? body?.message ?? t("auth.createAccountFailed"));
        setLoading(false);
        return;
      }
      window.location.href = "/";
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
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{t("auth.createAccount")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.joinApp")}</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-foreground/20 bg-card p-7 shadow-[5px_5px_0_0_rgba(0,0,0,0.08)]">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">{t("auth.fullName")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.emailAddress")}</Label>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password_confirmation">{t("auth.confirmPassword")}</Label>
            <Input id="password_confirmation" type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required minLength={8} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("auth.creatingAccount") : t("auth.createAccountBtn")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="text-primary hover:underline">
              {t("auth.signInLink")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
