"use client";

import { useState } from "react";
import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/request-guard";
import { useI18n } from "@/components/providers/i18n-provider";
import { AuthCard, AuthInput, AuthMessage, AuthSubmit, authLinkClass, useAuthRequest } from "@/components/auth/auth-form";

/**
 * New password form. Reached from a reset e-mail (then the old password is not asked) or by a signed-in user
 * (then the server asks for the current password). Signed-out visitors are redirected to /login by the middleware.
 */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [current, setCurrent] = useState("");
  const [needsCurrent, setNeedsCurrent] = useState(false);
  const { busy, error, setError, send, guard } = useAuthRequest();

  async function submit() {
    if (password.length < PASSWORD_MIN_LENGTH) { setError(t("Password must be at least 10 characters")); return; }
    if (password !== repeat) { setError(t("Passwords do not match")); return; }
    const result = await send("/api/auth/password", { password, ...(needsCurrent ? { current_password: current } : {}) });
    if (result.ok) { window.location.assign("/"); return; }
    // Not opened from a reset e-mail: the server wants the current password first.
    if (result.code === "current_password_required" && !needsCurrent) { setNeedsCurrent(true); setError(""); }
  }

  return (
    <AuthCard title={t("Set a new password")} subtitle={t("Other devices will be signed out after the change.")} footer={<Link href="/" className={authLinkClass}>{t("Cancel")}</Link>}>
      <form onSubmit={guard(submit)} className="space-y-4" noValidate>
        {needsCurrent && <AuthInput label={t("Current password")} type="password" name="current-password" autoComplete="current-password" required autoFocus value={current} onChange={event => setCurrent(event.target.value)} />}
        <AuthInput label={t("New password")} type="password" name="new-password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} autoFocus={!needsCurrent} hint={t("At least 10 characters. A long phrase is better than a short complex password.")} value={password} onChange={event => setPassword(event.target.value)} />
        <AuthInput label={t("Repeat the password")} type="password" name="repeat-password" autoComplete="new-password" required value={repeat} onChange={event => setRepeat(event.target.value)} />
        {error && <AuthMessage tone="error">{error}</AuthMessage>}
        <AuthSubmit busy={busy}>{busy ? t("Saving…") : t("Save the password")}</AuthSubmit>
      </form>
    </AuthCard>
  );
}
