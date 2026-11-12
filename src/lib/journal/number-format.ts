/**
 * How numbers are shown (Settings → Formats and Privacy). Set by the app shell from the user's preferences
 * before it renders; pure helpers below read it, so every screen follows one choice.
 */
export type DisplayOptions = { numberFormat: "plain" | "grouped" | "european"; privacy: boolean };
const display: DisplayOptions = { numberFormat: "plain", privacy: false };
/** True while amounts must be hidden. */
export function isPrivacyOn(): boolean { return display.privacy; }
export function setDisplayOptions(next: DisplayOptions) { display.numberFormat = next.numberFormat; display.privacy = next.privacy; }
export const HIDDEN_AMOUNT = "•••";

/** Fixed decimals with the chosen grouping: 1234.56 · 1,234.56 · 1 234,56. */
export function formatNumber(value: number, digits = 2, format: DisplayOptions["numberFormat"] = display.numberFormat): string {
  const fixed = Math.abs(value).toFixed(digits);
  const [whole, fraction] = fixed.split(".");
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  if (format === "plain") return sign + fixed;
  const separator = format === "grouped" ? "," : "\u202f";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return sign + grouped + (fraction === undefined ? "" : (format === "grouped" ? "." : ",") + fraction);
}

