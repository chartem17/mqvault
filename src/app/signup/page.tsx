"use client";

import { useState } from "react";
import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/request-guard";
import { getBrowserTimeZone } from "@/lib/time/timezone";
import { useI18n } from "@/components/providers/i18n-provider";
import { AuthCard, AuthInput, AuthMessage, AuthSubmit, authLinkClass, useAuthRequest } from "@/components/auth/auth-form";

export default function SignupPage() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [sentTo, setSentTo] = useState("");
  const { busy, error, setError, send, settle, guard } = useAuthRequest();

  async function submit() {
    if (password.length < PASSWORD_MIN_LENGTH) { setError(t("Password must be at least 10 characters")); return; }
    if (password !== repeat) { setError(t("Passwords do not match")); return; }
    const result = await send("/api/auth/signup", { email, password, locale, timezone: getBrowserTimeZone() });
    if (!result.ok) return;
    if (result.data.confirm === false) { window.location.assign("/"); return; }
    setSentTo(email.trim()); settle();
  }

  const footer = <>{t("Already have an account?")} <Link href="/login" className={authLinkClass}>{t("Sign in")}</Link></>;
  if (sentTo) {
    return (
      <AuthCard title={t("Check your e-mail")} footer={footer}>
        <AuthMessage tone="info">{t("We sent a confirmation link to {email}. Open it to finish creating your account. If it does not arrive in a few minutes, check the spam folder.", { email: sentTo })}</AuthMessage>
        <p className="text-sm text-muted-foreground">{t("If you already have an account with this e-mail, sign in or reset the password instead.")}</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("Create an account")} subtitle={t("Closed beta: registration is open to invited e-mail addresses.")} footer={footer}>
      <form onSubmit={guard(submit)} className="space-y-4" noValidate>
        <AuthInput label={t("E-mail")} type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} autoFocus required value={email} onChange={event => setEmail(event.target.value)} />
        <AuthInput label={t("Password")} type="password" name="new-password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} hint={t("At least 10 characters. A long phrase is better than a short complex password.")} value={password} onChange={event => setPassword(event.target.value)} />
        <AuthInput label={t("Repeat the password")} type="password" name="repeat-password" autoComplete="new-password" required value={repeat} onChange={event => setRepeat(event.target.value)} />
        {error && <AuthMessage tone="error">{error}</AuthMessage>}
        <AuthSubmit busy={busy}>{busy ? t("Creating the account…") : t("Create an account")}</AuthSubmit>
      </form>
    </AuthCard>
  );
}
