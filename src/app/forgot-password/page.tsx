"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/i18n-provider";
import { AuthCard, AuthInput, AuthMessage, AuthSubmit, authLinkClass, useAuthRequest } from "@/components/auth/auth-form";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, send, settle, guard } = useAuthRequest();

  async function submit() {
    if (!email) return;
    const result = await send("/api/auth/reset", { email });
    if (result.ok) { setSent(true); settle(); }
  }

  const footer = <Link href="/login" className={authLinkClass}>{t("Back to sign in")}</Link>;
  if (sent) {
    return (
      <AuthCard title={t("Check your e-mail")} footer={footer}>
        <AuthMessage tone="info">{t("If an account exists for this address, we sent a link to set a new password. The link works for one hour.")}</AuthMessage>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("Reset the password")} subtitle={t("Enter your account e-mail and we will send a link to set a new password.")} footer={footer}>
      <form onSubmit={guard(submit)} className="space-y-4" noValidate>
        <AuthInput label={t("E-mail")} type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} autoFocus required value={email} onChange={event => setEmail(event.target.value)} />
        {error && <AuthMessage tone="error">{error}</AuthMessage>}
        <AuthSubmit busy={busy}>{busy ? t("Sending…") : t("Send the link")}</AuthSubmit>
      </form>
    </AuthCard>
  );
}
