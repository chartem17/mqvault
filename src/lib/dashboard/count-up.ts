/**
 * Count-up for formatted numbers ("+1 902,00 $", "60.0%", "-0.50R"): the digits run from 0 to the
 * shown value while prefix, suffix and separators stay as the formatter wrote them. Text without a
 * number (privacy dots, "—") is returned as is.
 */
const NUMBER = /\d(?:[\d.,\s  ']*\d)?/;

export type CountUpTarget = { before: string; token: string; after: string; digits: number; total: number };

export function countUpTarget(text: string): CountUpTarget | null {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const token = match[0];
  const digitsOnly = token.replace(/\D/g, "");
  // Past 15 digits a double loses the exact value; such amounts are shown without animation.
  if (digitsOnly.length > 15) return null;
  return { before: text.slice(0, match.index), token, after: text.slice(match.index + token.length), digits: digitsOnly.length, total: Number(digitsOnly) };
}

/** The text at `progress` (0..1, eased by the caller) of the way from zero to the target. */
export function countUpText(target: CountUpTarget, progress: number): string {
  if (progress >= 1) return target.before + target.token + target.after;
  const value = Math.round(target.total * Math.max(0, progress));
  const chars = [...target.token];
  // Digits after the last separator are the fraction (or a thousands group): keep them, so "0.00" never shrinks to "0".
  let lastSeparator = -1;
  chars.forEach((char, index) => { if (!/\d/.test(char)) lastSeparator = index; });
  const minDigits = lastSeparator < 0 ? 1 : chars.slice(lastSeparator + 1).length + 1;
  const digits = String(value).padStart(minDigits, "0");
  let next = digits.length - 1;
  let out = "";
  for (let index = chars.length - 1; index >= 0 && next >= 0; index -= 1) {
    const char = chars[index];
    if (/\d/.test(char)) { out = digits[next] + out; next -= 1; }
    else out = char + out;
  }
  return target.before + digits.slice(0, next + 1) + out + target.after;
}

export function easeOutCubic(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return 1 - (1 - p) ** 3;
}
