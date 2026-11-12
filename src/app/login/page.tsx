"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/auth/request-guard";
import { msg } from "@/lib/i18n/core";
import { useI18n } from "@/components/providers/i18n-provider";
import { AuthCard, AuthInput, AuthMessage, AuthSubmit, authLinkClass, useAuthRequest } from "@/components/auth/auth-form";
import { VerifyCode } from "@/components/auth/verify-code";
import { CaptchaBox, useCaptcha } from "@/components/auth/turnstile";
import type { OtpStatus } from "@/components/ui/otp-input";

/** Why the visitor was sent back here (set by /auth/callback, /auth/confirm and the password form). */
const REASONS: Record<string, { tone: "error" | "info"; text: string }> = {
  link: { tone: "error", text: msg("This link has expired or was already used. If you were confirming your e-mail, just sign in; otherwise request a new link.") },
  not_invited: { tone: "error", text: msg("This e-mail is not on the closed beta list yet") },
  unconfirmed: { tone: "error", text: msg("Confirm your e-mail address to continue") },
  unauthenticated: { tone: "error", text: msg("Could not sign in") },
  unavailable: { tone: "error", text: msg("Service is temporarily unavailable") },
  provider: { tone: "error", text: msg("Google sign-in is not available right now") },
};
const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

function LoginForm() {
  const { t } = useI18n();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));
  const reason = REASONS[search.get("error") ?? search.get("notice") ?? ""];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, send, guard } = useAuthRequest();
  const [verifying, setVerifying] = useState("");
  const captcha = useCaptcha();
  const [codeStatus, setCodeStatus] = useState<OtpStatus>("idle");

  async function submit() {
    if (!email || !password) return;
    if (!captcha.ready) return;
    const result = await send("/api/auth/login", { email, password, captchaToken: captcha.token });
    captcha.reset();
    // A full navigation, so every provider reloads its data for the signed-in user.
    if (result.ok) { window.location.assign(next); return; }
    // Right password, unconfirmed e-mail: send a fresh letter and confirm with its code in the same card.
    if (result.code === "email_unconfirmed") {
      const address = email.trim();
      await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: address }), credentials: "same-origin" }).catch(() => undefined);
      setVerifying(address);
    }
  }

  if (verifying) {
    return <AuthCard title={codeStatus === "success" ? t("Verified successfully") : t("Let's verify your email")} tone={codeStatus === "success" ? "success" : undefined}>
      <VerifyCode email={verifying} onStatus={setCodeStatus} onVerified={() => window.location.assign(next)} />
    </AuthCard>;
  }

  return (
    <AuthCard tabs="signin" title={t("Sign in")} subtitle={t("Your trading journal and discipline dashboard.")} footer={<>{t("No account yet?")} <Link href="/signup" className={authLinkClass}>{t("Create an account")}</Link></>}>
      {reason && !error && <AuthMessage tone={reason.tone}>{t(reason.text)}</AuthMessage>}
      <form onSubmit={guard(submit)} className="space-y-4" noValidate>
        <AuthInput label={t("E-mail")} type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} autoFocus required value={email} onChange={event => setEmail(event.target.value)} />
        <AuthInput label={t("Password")} type="password" name="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
        <CaptchaBox captcha={captcha} />
        {error && <AuthMessage tone="error">{error}</AuthMessage>}
        <AuthSubmit busy={busy || !captcha.ready}>{busy ? t("Signing in…") : t("Sign in")}</AuthSubmit>
      </form>
      <div className="text-center text-sm"><Link href="/forgot-password" className={authLinkClass}>{t("Forgot your password?")}</Link></div>
      {googleEnabled && <>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{t("or")}<span className="h-px flex-1 bg-border" /></div>
        <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-secondary text-sm font-medium text-secondary-foreground hover:bg-accent">{t("Continue with Google")}</a>
      </>}
    </AuthCard>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
