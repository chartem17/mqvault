"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useI18n } from "@/components/providers/i18n-provider";

/**
 * Cloudflare Turnstile ("are you human?") for sign-up, sign-in, password reset and resending the code
 * (package 3). Off until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; Supabase Auth checks the token itself
 * (Authentication → Attack Protection → CAPTCHA), so bots cannot skip it by calling Supabase directly.
 * Each token works once: call `reset()` after every attempt.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  // Added by the app's own (nonce-trusted) code, so the CSP's 'strict-dynamic' lets it run.
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT; script.async = true;
    script.onload = () => resolve(); script.onerror = () => { loading = null; reject(new Error("captcha")); };
    document.head.appendChild(script);
  });
  return loading;
}

export function useCaptcha() {
  const { locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);
  const enabled = SITE_KEY !== "";

  useEffect(() => {
    if (!enabled || !box.current) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current || !window.turnstile) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: SITE_KEY, language: locale === "uk" ? "uk" : "en", theme: resolvedTheme === "light" ? "light" : "dark", size: "flexible",
        callback: (value: string) => { setToken(value); setFailed(false); },
        "expired-callback": () => setToken(""),
        "error-callback": () => { setToken(""); setFailed(true); },
      });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (widget.current && window.turnstile) window.turnstile.remove(widget.current); widget.current = null; };
  }, [enabled, locale, resolvedTheme]);

  const reset = useCallback(() => { setToken(""); if (widget.current && window.turnstile) window.turnstile.reset(widget.current); }, []);
  return { enabled, token, ready: !enabled || token !== "", reset, failed, box };
}

/** The widget's place in a form. Renders nothing while CAPTCHA is off. */
export function CaptchaBox({ captcha }: { captcha: ReturnType<typeof useCaptcha> }) {
  const { t } = useI18n();
  if (!captcha.enabled) return null;
  return <div className="space-y-1">
    <div ref={captcha.box} className="min-h-[65px]" />
    {captcha.failed && <p role="alert" className="text-xs text-destructive">{t("The human check did not load. Reload the page or try another browser.")}</p>}
  </div>;
}
