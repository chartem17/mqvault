import { msg } from "../i18n/core";

/** In-app help (/help). English source text; shown through t() with translations in uk.ts. */
export type FaqItem = { q: string; a: string };
export type FaqSection = { id: string; title: string; items: FaqItem[] };

export const FAQ: FaqSection[] = [
  { id: "start", title: msg("Getting started"), items: [
    { q: msg("How do I start?"), a: msg("Add a trading account, then bring in trades: import a CSV from your broker, connect MT5 Bridge for automatic sync, or add trades by hand in the journal. The Getting started card on Home walks you through it.") },
    { q: msg("What is the difference between personal and prop accounts?"), a: msg("A prop account has a profit target, loss limits, a minimum of trading days and a phase. Home and Overview then show the progress and the room left to the daily limit. Personal accounts have none of that.") },
    { q: msg("Can I see several accounts together?"), a: msg("Yes. The account switcher at the top chooses one account or several at once; Home, Overview, Journal and Strategy control all follow that choice. Prop limits are shown only when a single prop account is selected.") },
  ] },
  { id: "connect", title: msg("Connecting accounts"), items: [
    { q: msg("Which ways of adding trades are there?"), a: msg("Three: MT5 Bridge syncs closed trades from your MetaTrader 5 terminal automatically; CSV import loads a file exported from your broker or another journal; manual entry adds a single trade in the journal. You can mix them on one account.") },
    { q: msg("How do I connect MT5 Bridge?"), a: msg("Run MQVault Bridge on the Windows computer where MT5 is open; it shows an 8-character code. Open MT5 Bridge in the sidebar, enter the code and confirm the computer. Trades sync within a minute, and when Bridge sees a new MT5 account, Home asks whether it is personal or prop.") },
    { q: msg("How does CSV import work?"), a: msg("In the journal choose Import CSV, pick the file and the target account. The preview shows how columns were recognised and which rows will be skipped; trades already in the journal are not duplicated. Times are read in the broker's time zone of the account.") },
    { q: msg("I entered the wrong time zone for an account"), a: msg("The broker's time zone is used to read times you type by hand or import from a file. For MT5 Bridge it is detected from the broker's server automatically when the account is created. If times look shifted, tell us which account rather than changing anything.") },
  ] },
  { id: "home", title: msg("Home"), items: [
    { q: msg("What is on Home?"), a: msg("Today at a glance: the day dial with the trading sessions, today's result and trades, the checklist before you trade, monthly goals, the review streak and a weekly report. For a prop account it also shows how much room is left to the daily and total loss limits.") },
    { q: msg("What is the weekly report?"), a: msg("A summary of the past week: result, best and worst trade, discipline (trades reviewed, rules broken) and what to work on. Open it from the card on Home; arrows switch between weeks.") },
  ] },
  { id: "overview", title: msg("Overview"), items: [
    { q: msg("How do I change the dashboard?"), a: msg("Choose Edit on Overview: add widgets from the library, drag them, change their size or remove them, then Save layout. The layout is stored with your account and opens the same on every device.") },
    { q: msg("Why is Avg R empty or different from what I expected?"), a: msg("R is measured from the initial stop of a trade. Trades without a stop or without a known risk have no R and are left out of R averages instead of counting as zero. Only closed trades are counted.") },
  ] },
  { id: "journal", title: msg("Journal and review"), items: [
    { q: msg("Why review trades?"), a: msg("Setup, emotion and whether the trade followed the plan turn a list of trades into answers: which setups pay, which states cost money, what breaking a rule costs. Day review lets you do it in a few taps per trade.") },
    { q: msg("How is net P&L calculated?"), a: msg("Net = gross − commission − fees + swap. It is calculated on the server from the broker's numbers and never changed by the interface.") },
    { q: msg("How are risk and R calculated?"), a: msg("Risk is the money you would lose at the initial stop; R is the result divided by that risk. Moving the stop later does not change the trade's R. Risk % is measured against the account's starting balance.") },
    { q: msg("Which time zone is used?"), a: msg("Days, months and periods follow the time zone in Settings. Trading sessions (Asia, London, New York) follow the markets' own clocks. Times you type for a manual trade are read in the broker's time zone of the account.") },
    { q: msg("Can I undo a deletion?"), a: msg("Yes, for 10 seconds: a bar with Undo appears after you delete a trade or an account. After that the deletion is final.") },
  ] },
  { id: "strategy", title: msg("Strategy control"), items: [
    { q: msg("What does a strategy do?"), a: msg("It turns your rules into checks: trades and losses per day, allowed sessions and instruments, risk range, news windows. Strategy Control shows how often each rule was broken and what it cost in R.") },
    { q: msg("What does \"no data\" next to a rule mean?"), a: msg("The trades in the period do not have the information the rule needs, for example no stop for a risk rule. Fill it in the journal or during day review and the rule will be checked.") },
  ] },
  { id: "security", title: msg("Security"), items: [
    { q: msg("Is MT5 Bridge safe?"), a: msg("Bridge only reads the history of the terminal that is already open on your PC. It never asks for your MT5 password, cannot place or change orders, and signs every request with a key stored on your computer. You can disconnect a computer at any time in Settings → MT5 Bridge.") },
    { q: msg("How is the site protected?"), a: msg("Connections are encrypted, the session lives in a secure cookie that scripts cannot read, every request is checked on the server and again in the database, and sign-in attempts are limited. Settings → Security lists recent sign-ins and lets you sign out everywhere.") },
    { q: msg("I think someone else used my account"), a: msg("Change the password in Settings, then choose Sign out everywhere. Check Settings → Security → Recent activity and disconnect any computer you do not recognise in MT5 Bridge.") },
  ] },
  { id: "data", title: msg("Your data and account"), items: [
    { q: msg("Who can see my journal?"), a: msg("Only you. Every request is limited to your own user on the server, and the database gives the browser no direct access.") },
    { q: msg("Can I take my data with me?"), a: msg("Yes. Settings → Your data downloads everything as JSON or your trades as CSV.") },
    { q: msg("How do I delete my account?"), a: msg("Settings → Delete account removes your profile and every account, trade, strategy and connected computer. It cannot be undone, so export your data first.") },
  ] },
  { id: "troubleshooting", title: msg("Troubleshooting"), items: [
    { q: msg("The confirmation e-mail did not arrive"), a: msg("Check the spam folder and wait a few minutes. On the code screen choose Resend; there is a short pause between attempts. Make sure the address was typed correctly.") },
    { q: msg("Bridge shows the computer as offline"), a: msg("MT5 and the Bridge program must both be running on that computer and it must be online. Restart the program; if the computer was disconnected in Settings, connect it again with a new code.") },
    { q: msg("Trades appear at the wrong time"), a: msg("Check the time zone in Settings (it sets days and periods) and the broker's time zone of the account (it is used for manual and CSV trades).") },
    { q: msg("Numbers differ from my broker's statement"), a: msg("Make sure all trades of the period are in the journal and that commissions and swaps were imported. Net in the journal comes from the broker's numbers; if it still differs, tell us which trade.") },
    { q: msg("A page shows an error or does not load"), a: msg("Reload the page. If it keeps happening, sign out and in again or try another browser. Your data is safe; errors are reported to us automatically without personal details.") },
  ] },
];

export type ChangelogEntry = { date: string; items: string[] };
/** Newest first. The sidebar marks Help as new until the latest date is seen. */
export const CHANGELOG: ChangelogEntry[] = [
  { date: "2026-11-19", items: [
    msg("Every section has its own address (/journal, /overview, …); old links keep working."),
    msg("Help covers every section, connecting accounts, security and troubleshooting."),
    msg("Terms of Use, Privacy Policy, Cookie Policy and Risk disclosure, with links at the bottom of every page."),
  ] },
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
  { keys: ["G", "P"], label: msg("Go to Playbook") },
  { keys: ["G", "S"], label: msg("Go to Strategy control") },
  { keys: ["G", "R"], label: msg("Start the day review") },
  { keys: ["Esc"], label: msg("Close a dialog") },
];

/** "g" then a letter: where it leads. */
export const GO_TO: Record<string, string> = { h: "/home", o: "/overview", j: "/journal", p: "/playbook", s: "/strategy-control", r: "/journal?review=1" };
