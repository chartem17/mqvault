"use client";

import { useEffect, useRef, useState } from "react";
import { OTP_LENGTH } from "@/lib/auth/password-strength";
import { OtpInput, type OtpInputHandle, type OtpStatus } from "@/components/ui/otp-input";
import { useI18n } from "@/components/providers/i18n-provider";

const RESEND_SECONDS = 60;

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  return { ok: response.ok, data: await response.json().catch(() => ({})) as { error?: string; wait?: number } };
}

/**
 * "Let's verify your email": the code from the confirmation letter, typed into separate boxes. Checked as soon as
 * the last digit lands; on error the row shakes and clears, on success the boxes merge into a check mark and
 * `onVerified` runs after the animation. The link in the same letter keeps working as before (/auth/confirm).
 */
export function VerifyCode({ email, onVerified, onStatus }: { email: string; onVerified: () => void; onStatus?: (status: OtpStatus) => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [status, setStatusState] = useState<OtpStatus>("idle");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [sending, setSending] = useState(false);
  const input = useRef<OtpInputHandle>(null);
  const timers = useRef<number[]>([]);
  const later = (run: () => void, ms: number) => { timers.current.push(window.setTimeout(run, ms)); };
  useEffect(() => () => { timers.current.forEach(id => window.clearTimeout(id)); }, []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn(value => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);
  const setStatus = (next: OtpStatus) => { setStatusState(next); onStatus?.(next); };

  async function verify(value: string) {
    setStatus("checking"); setError("");
    let reply: Awaited<ReturnType<typeof post>> = { ok: false, data: {} };
    try { reply = await post("/api/auth/verify", { email, code: value }); } catch { reply = { ok: false, data: { error: "No connection" } }; }
    if (reply.ok) { setStatus("success"); later(onVerified, 1600); return; }
    setStatus("error"); setError(reply.data.error ?? "Invalid or expired code");
    later(() => { setCode(""); setStatus("idle"); input.current?.focus(); }, 520);
  }

  async function resend() {
    if (resendIn > 0 || sending) return;
    setSending(true); setError("");
    try {
      const reply = await post("/api/auth/resend", { email });
      if (!reply.ok) setError(reply.data.error ?? "Something went wrong. Try again.");
      else { setResendIn(reply.data.wait ?? RESEND_SECONDS); setCode(""); setStatus("idle"); input.current?.focus(); }
    } catch { setError("No connection"); }
    setSending(false);
  }

  const done = status === "success";
  return <div className="space-y-5 text-center">
    <p id="otp-hint" className="text-sm text-muted-foreground">
      {done ? t("Opening your workspace…") : t("Enter the {count}-digit code we sent to {email}. The link in the same letter works too.", { count: OTP_LENGTH, email })}
    </p>
    <OtpInput ref={input} length={OTP_LENGTH} value={code} onChange={value => { setCode(value); if (error) setError(""); }} onComplete={value => void verify(value)}
      status={status} autoFocus aria-label={t("Verification code")} aria-describedby="otp-hint" />
    <div className="min-h-5">{!done && error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}</div>
    {!done && <p className="text-sm text-muted-foreground">
      {t("Didn't receive the code?")}{" "}
      <button type="button" onClick={() => void resend()} disabled={resendIn > 0 || sending} className="font-medium text-primary disabled:cursor-default disabled:text-muted-foreground">
        {resendIn > 0 ? t("Resend in {seconds}s", { seconds: resendIn }) : t("Resend")}
      </button>
    </p>}
  </div>;
}
