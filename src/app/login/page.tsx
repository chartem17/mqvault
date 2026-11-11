"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { OTP_LENGTH, PASSWORD_MIN, passwordStrength, safeNextPath } from "@/lib/auth/request-guard";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageToggle } from "@/components/settings/language-toggle";
import { Button, Input } from "@/components/ui/primitives";
import { OtpInput, PasswordStrength, type OtpInputHandle, type OtpStatus } from "@/components/ui/otp-input";
import "./login.css";

type Mode = "signin" | "signup";
type Step = "form" | "forgot" | "verify" | "password";
type Flow = "signup" | "recovery";
type Reply = { ok?: boolean; step?: string; flow?: Flow; error?: string; wait?: number };

const RESEND_SECONDS = 60;

async function post(path: string, body: Record<string, unknown>): Promise<{ status: number; data: Reply }> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  const data = await response.json().catch(() => ({})) as Reply;
  return { status: response.status, data };
}

function GoogleMark() {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.300-2.100 3.500-5.200 3.500-8.700z" />
    <path fill="#34A853" d="M12 24c3.200 0 6-1.100 8-2.900l-3.900-3c-1.100.7-2.500 1.200-4.100 1.200-3.100 0-5.800-2.100-6.700-5H1.300v3.100A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.300 14.300a7.200 7.200 0 0 1 0-4.600V6.600H1.300a12 12 0 0 0 0 10.800l4-3.100z" />
    <path fill="#EA4335" d="M12 4.800c1.800 0 3.300.6 4.600 1.800l3.400-3.400A12 12 0 0 0 1.300 6.600l4 3.100c.9-2.900 3.600-4.900 6.700-4.900z" />
  </svg>;
}

export default function LoginPage() {
  const { t, locale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("form");
  const [flow, setFlow] = useState<Flow>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");
  const [resendIn, setResendIn] = useState(0);
  const [done, setDone] = useState(false);
  const otp = useRef<OtpInputHandle>(null);
  const timers = useRef<number[]>([]);
  const later = (run: () => void, ms: number) => { timers.current.push(window.setTimeout(run, ms)); };
  useEffect(() => () => { timers.current.forEach(id => window.clearTimeout(id)); }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "oauth") setError("Google sign-in did not complete. Try again.");
  }, []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn(value => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const nextPath = () => safeNextPath(new URLSearchParams(window.location.search).get("next"));
  const enter = useCallback(() => { window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get("next"))); }, []);
  const strength = passwordStrength(password);
  const strengthLabel = [t("Use at least {count} characters", { count: PASSWORD_MIN }), t("Weak password"), t("Fair password"), t("Good password"), t("Strong password")][strength];

  function openVerify(nextFlow: Flow) {
    setFlow(nextFlow); setCode(""); setOtpStatus("idle"); setError(""); setResendIn(RESEND_SECONDS); setStep("verify");
  }
  function switchMode(next: Mode) { setMode(next); setError(""); setPassword(""); setReveal(false); }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); } catch { setError("No connection"); }
    setBusy(false);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const { data } = mode === "signin"
        ? await post("/api/auth/login", { email, password })
        : await post("/api/auth/signup", { email, password, locale, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (data.ok) { setDone(true); enter(); return; }
      if (data.step === "verify") { openVerify("signup"); return; }
      setError(data.error ?? (mode === "signin" ? "Could not sign in" : "Could not sign up. Try again later."));
    });
  }

  function submitForgot(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const { data } = await post("/api/auth/reset", { email });
      if (data.step === "verify") { setPassword(""); openVerify("recovery"); return; }
      setError(data.error ?? "Could not send the code");
    });
  }

  async function verify(value: string) {
    setOtpStatus("checking"); setError("");
    let reply: Reply = {};
    try { reply = (await post("/api/auth/verify", { email, code: value, flow })).data; } catch { reply = { error: "No connection" }; }
    if (reply.ok) {
      setOtpStatus("success");
      // The boxes merge into the check mark, then the app (or the new-password step) opens.
      later(() => { if (flow === "recovery") { setStep("password"); setOtpStatus("idle"); setCode(""); } else enter(); }, 1700);
      return;
    }
    setOtpStatus("error"); setError(reply.error ?? "Invalid or expired code");
    later(() => { setCode(""); setOtpStatus("idle"); otp.current?.focus(); }, 520);
  }

  function resend() {
    if (resendIn > 0 || busy) return;
    void run(async () => {
      const { data } = await post("/api/auth/resend", { email, flow });
      if (data.error) { setError(data.error); return; }
      setResendIn(data.wait ?? RESEND_SECONDS); setCode(""); setOtpStatus("idle"); otp.current?.focus();
    });
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const { data } = await post("/api/auth/password", { password });
      if (data.ok) { setDone(true); enter(); return; }
      setError(data.error ?? "Could not change the password");
    });
  }

  const success = otpStatus === "success" || done;
  const passwordField = (autoComplete: "current-password" | "new-password", label: string) => <div className="relative">
    <Input
      type={reveal ? "text" : "password"} name="password" autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? PASSWORD_MIN : undefined}
      value={password} onChange={event => setPassword(event.target.value)} aria-label={label} placeholder={label} className="login-input min-h-11 pr-11"
    />
    <button type="button" onClick={() => setReveal(value => !value)} aria-label={reveal ? t("Hide password") : t("Show password")} aria-pressed={reveal}
      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
      {reveal ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  </div>;
  const errorLine = error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>;
  const backButton = (onClick: () => void) => <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("Back")}
  </button>;

  return (
    <main className="login-stage">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <Button variant="secondary" size="icon" aria-label={t("Toggle theme")} title={t("Toggle theme")} onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}>
          <Sun className="hidden h-4 w-4 [.light_&]:block" aria-hidden="true" /><Moon className="h-4 w-4 [.light_&]:hidden" aria-hidden="true" />
        </Button>
        <LanguageToggle />
      </div>

      <section className="glass-card" data-tone={success ? "success" : undefined} aria-busy={busy || otpStatus === "checking" || undefined}>
        {step === "form" && <form key="form" onSubmit={submitForm} className="login-step space-y-4" noValidate={false}>
          <div>
            <h1 className="text-xl font-semibold">Trade Vault</h1>
            <p className="mt-1 text-sm text-muted-foreground">{mode === "signin" ? t("Sign in to your trading journal.") : t("Create your account to start journaling.")}</p>
          </div>
          <div className="login-tabs" role="tablist" aria-label={t("Sign in or sign up")} data-mode={mode}>
            <span className="login-tabs-pill" aria-hidden="true" />
            <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => switchMode("signin")}>{t("Sign in")}</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>{t("Sign up")}</button>
          </div>
          <a href={`/api/auth/oauth?provider=google&next=${encodeURIComponent(typeof window === "undefined" ? "/" : nextPath())}`}
            className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent">
            <GoogleMark />{t("Continue with Google")}
          </a>
          <div className="login-divider">{t("or")}</div>
          <Input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="off" spellCheck={false} required autoFocus
            value={email} onChange={event => setEmail(event.target.value)} aria-label={t("Email")} placeholder={t("Email")} className="login-input min-h-11" />
          {passwordField(mode === "signin" ? "current-password" : "new-password", t("Password"))}
          {mode === "signup" && <PasswordStrength score={strength} label={strengthLabel} />}
          {errorLine}
          <Button type="submit" size="lg" loading={busy} disabled={!email || !password || done} className="w-full">
            {done ? t("Opening…") : busy ? (mode === "signin" ? t("Signing in…") : t("Creating account…")) : mode === "signin" ? t("Sign in") : t("Create account")}
          </Button>
          {mode === "signin" && <button type="button" onClick={() => { setError(""); setStep("forgot"); }} className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">{t("Forgot password?")}</button>}
        </form>}

        {step === "forgot" && <form key="forgot" onSubmit={submitForgot} className="login-step space-y-4">
          {backButton(() => { setError(""); setStep("form"); })}
          <div>
            <h1 className="text-xl font-semibold">{t("Reset your password")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("Enter your email and we will send a code to set a new password.")}</p>
          </div>
          <Input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="off" spellCheck={false} required autoFocus
            value={email} onChange={event => setEmail(event.target.value)} aria-label={t("Email")} placeholder={t("Email")} className="login-input min-h-11" />
          {errorLine}
          <Button type="submit" size="lg" loading={busy} disabled={!email} className="w-full">{busy ? t("Sending…") : t("Send code")}</Button>
        </form>}

        {step === "verify" && <div key="verify" className="login-step space-y-5 text-center">
          {otpStatus !== "success" && <div className="text-left">{backButton(() => { setError(""); setStep(flow === "recovery" ? "forgot" : "form"); })}</div>}
          <div>
            <h1 className="text-xl font-semibold">{otpStatus === "success" ? t("Verified successfully") : t("Let's verify your email")}</h1>
            <p id="otp-hint" className="mt-1 text-sm text-muted-foreground">
              {otpStatus === "success" ? (flow === "recovery" ? t("Now choose a new password.") : t("Opening your workspace…")) : t("Enter the {count}-digit code we sent to {email}.", { count: OTP_LENGTH, email })}
            </p>
          </div>
          <OtpInput ref={otp} length={OTP_LENGTH} value={code} onChange={value => { setCode(value); if (error) setError(""); }} onComplete={value => void verify(value)}
            status={otpStatus} autoFocus aria-label={t("Verification code")} aria-describedby="otp-hint" />
          <div className="min-h-5">{otpStatus !== "success" && errorLine}</div>
          {otpStatus !== "success" && <p className="text-sm text-muted-foreground">
            {t("Didn't receive the code?")}{" "}
            <button type="button" onClick={resend} disabled={resendIn > 0 || busy} className="font-medium text-primary disabled:cursor-default disabled:text-muted-foreground">
              {resendIn > 0 ? t("Resend in {seconds}s", { seconds: resendIn }) : t("Resend")}
            </button>
          </p>}
        </div>}

        {step === "password" && <form key="password" onSubmit={submitPassword} className="login-step space-y-4">
          <div>
            <h1 className="text-xl font-semibold">{t("Choose a new password")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("You are signed in. Set a new password for {email}.", { email })}</p>
          </div>
          <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
          {passwordField("new-password", t("New password"))}
          <PasswordStrength score={strength} label={strengthLabel} />
          {errorLine}
          <Button type="submit" size="lg" loading={busy} disabled={password.length < PASSWORD_MIN || done} className="w-full">{done ? t("Opening…") : busy ? t("Saving…") : t("Save password")}</Button>
          <button type="button" onClick={enter} className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">{t("Skip for now")}</button>
        </form>}
      </section>
    </main>
  );
}
