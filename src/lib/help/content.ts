import { msg } from "../i18n/core";

/** In-app help (/help). English source text; shown through t() with translations in uk.ts. */
export type FaqItem = { q: string; a: string };
export type FaqSection = { id: string; title: string; items: FaqItem[] };

export const FAQ: FaqSection[] = [
  { id: "start", title: msg("Getting started"), items: [
    { q: msg("How do I start?"), a: msg("Add a trading account, then bring in trades: import a CSV from your broker, connect MT5 Bridge for automatic sync, or add trades by hand in the journal. The Getting started card on Home walks you through it.") },
    { q: msg("What is the difference between personal and prop accounts?"), a: msg("A prop account has a profit target, loss limits, a minimum of trading days and a phase. Home and Overview then show the progress and the room left to the daily limit. Personal accounts have none of that.") },
  ] },
  { id: "journal", title: msg("Journal and review"), items: [
    { q: msg("Why review trades?"), a: msg("Setup, emotion and whether the trade followed the plan turn a list of trades into answers: which setups pay, which states cost money, what breaking a rule costs. Day review lets you do it in a few taps per trade.") },
    { q: msg("How is net P&L calculated?"), a: msg("Net = gross − commission − fees + swap. It is calculated on the server from the broker's numbers and never changed by the interface.") },
    { q: msg("Which time zone is used?"), a: msg("Days, months and periods follow the time zone in Settings. Trading sessions (Asia, London, New York) follow the markets' own clocks. Times you type for a manual trade are read in the broker's time zone of the account.") },
  ] },
  { id: "strategy", title: msg("Strategy control"), items: [
    { q: msg("What does a strategy do?"), a: msg("It turns your rules into checks: trades and losses per day, allowed sessions and instruments, risk range, news windows. Strategy Control shows how often each rule was broken and what it cost in R.") },
  ] },
  { id: "bridge", title: msg("MT5 Bridge"), items: [
    { q: msg("Is MT5 Bridge safe?"), a: msg("Bridge only reads the history of the terminal that is already open on your PC. It never asks for your MT5 password, cannot place or change orders, and signs every request with a key stored on your computer. You can disconnect a computer at any time in Settings → MT5 Bridge.") },
  ] },
  { id: "data", title: msg("Your data and account"), items: [
    { q: msg("Who can see my journal?"), a: msg("Only you. Every request is limited to your own user on the server, and the database gives the browser no direct access.") },
    { q: msg("Can I take my data with me?"), a: msg("Yes. Settings → Your data downloads everything as JSON or your trades as CSV.") },
    { q: msg("How do I delete my account?"), a: msg("Settings → Delete account removes your profile and every account, trade, strategy and connected computer. It cannot be undone, so export your data first.") },
  ] },
];

export type ChangelogEntry = { date: string; items: string[] };
/** Newest first. The sidebar marks Help as new until the latest date is seen. */
export const CHANGELOG: ChangelogEntry[] = [
  { date: "2026-11-11", items: [
    msg("Accounts: sign up with e-mail or Google; your journal is private to you."),
    msg("New sidebar with page search (Ctrl/⌘K), profile and settings pages."),
    msg("Home: getting started, a checklist before you trade, monthly goals and a review streak."),
    msg("Settings: hide amounts, number format, week start, default account and risk, export of your data."),
  ] },
  { date: "2026-11-09", items: [
    msg("MT5 Bridge: trades sync from your terminal automatically."),
    msg("Economic calendar and red news next to your trades."),
  ] },
];
export const LATEST_CHANGE = CHANGELOG[0].date;

export type Shortcut = { keys: string[]; label: string };
export const SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl/⌘", "K"], label: msg("Search pages") },
  { keys: ["?"], label: msg("Show keyboard shortcuts") },
  { keys: ["G", "H"], label: msg("Go to Home") },
  { keys: ["G", "O"], label: msg("Go to Overview") },
  { keys: ["G", "J"], label: msg("Go to Journal") },
  { keys: ["G", "S"], label: msg("Go to Strategy control") },
  { keys: ["G", "R"], label: msg("Start the day review") },
  { keys: ["Esc"], label: msg("Close a dialog") },
];

/** "g" then a letter: where it leads. */
export const GO_TO: Record<string, string> = { h: "/?tab=home", o: "/?tab=overview", j: "/?tab=journal", s: "/?tab=strategy-control", r: "/?tab=journal&review=1" };
