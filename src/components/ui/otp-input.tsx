"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import "./otp-input.css";

export type OtpStatus = "idle" | "checking" | "error" | "success";
export type OtpInputHandle = { focus: () => void };
type Props = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Called once when the last box is filled (typing or paste). */
  onComplete?: (value: string) => void;
  status?: OtpStatus;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label": string;
  "aria-describedby"?: string;
};

/**
 * One-time code as a row of boxes over a single real input, so phone keyboards, SMS/e-mail autofill
 * (`autocomplete="one-time-code"`), paste and Backspace all behave natively. The parent owns the value and the
 * status; on "error" it clears the value and the caret returns to the first box, on "success" the boxes merge
 * into a check mark.
 */
export const OtpInput = forwardRef<OtpInputHandle, Props>(function OtpInput({ length, value, onChange, onComplete, status = "idle", disabled, autoFocus, ...aria }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const [merged, setMerged] = useState(false);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);
  useEffect(() => {
    if (status !== "success") { setMerged(false); return; }
    const timer = window.setTimeout(() => setMerged(true), 420);
    return () => window.clearTimeout(timer);
  }, [status]);
  const locked = disabled || status === "checking" || status === "success";
  const active = Math.min(value.length, length - 1);

  function update(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, length);
    if (next === value) return;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  }

  return <div className="ui-otp" data-status={status} data-merged={merged || undefined} style={{ maxWidth: `${length * 3.75}rem`, marginInline: "auto" }}>
    <input
      {...aria} ref={input} className="ui-otp-input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
      autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={length} value={value} disabled={locked} autoFocus={autoFocus}
      aria-invalid={status === "error" || undefined}
      onChange={event => update(event.target.value)}
      onPaste={event => { event.preventDefault(); update(event.clipboardData.getData("text")); }}
      onFocus={event => { const end = event.target.value.length; event.target.setSelectionRange(end, end); }}
    />
    {Array.from({ length }, (_, index) => {
      const char = value[index];
      return <span key={index} aria-hidden="true" className="ui-otp-box" data-filled={char !== undefined} data-active={index === active && !locked} style={{ "--i": index } as React.CSSProperties}>
        {char !== undefined ? <span key={char + index} className="ui-otp-char">{char}</span> : index === active ? <span className="ui-otp-caret" /> : null}
      </span>;
    })}
    <span className="ui-otp-check" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  </div>;
});

/** Four-segment password strength meter; `score` is 0–4 (see `passwordStrength`). */
export function PasswordStrength({ score, label }: { score: 0 | 1 | 2 | 3 | 4; label: string }) {
  return <div className="space-y-1.5" aria-live="polite">
    <div className="ui-strength" data-score={score} role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-label={label}><span /><span /><span /><span /></div>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>;
}
