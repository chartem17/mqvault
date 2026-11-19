import { msg } from "../i18n/core";

/**
 * Legal texts (package 4). English source text, translated through t() like the rest of the site.
 * They describe what the site actually does today; when a feature changes what is collected or shared,
 * update the matching section and `updated`. Placeholders {operator}, {contact} and {jurisdiction} are filled
 * from LEGAL_OPERATOR; while those are empty the pages say the text is a draft.
 */

/** Who runs the service. Filled in by the owner before the public launch; null = not decided yet. */
export const LEGAL_OPERATOR: { name: string | null; contact: string | null; jurisdiction: string | null } = {
  name: null,
  contact: null,
  jurisdiction: null,
};
export const legalDraft = () => !LEGAL_OPERATOR.name || !LEGAL_OPERATOR.contact || !LEGAL_OPERATOR.jurisdiction;

export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDocument = { slug: "terms" | "privacy" | "cookies" | "risk-disclosure"; title: string; summary: string; updated: string; sections: LegalSection[] };

const terms: LegalDocument = {
  slug: "terms", title: msg("Terms of Use"), updated: "2026-11-19",
  summary: msg("The rules for using Trade Vault: what the service does, what you are responsible for and what we are not."),
  sections: [
    { heading: msg("Who we are"), paragraphs: [
      msg("Trade Vault is a trading journal and analytics workspace operated by {operator}. You can reach us at {contact}."),
      msg("By creating an account or using the service you accept these terms. If you do not agree, do not use the service."),
    ] },
    { heading: msg("What the service is"), paragraphs: [
      msg("Trade Vault helps you record trades, review them and measure your own results and discipline. It is a record-keeping and self-analysis tool."),
      msg("Trade Vault is not a broker, does not hold money, does not place orders and does not give investment, financial, tax or legal advice. Nothing on the site is a recommendation to buy or sell anything."),
    ] },
    { heading: msg("Closed beta"), paragraphs: [
      msg("The service is in a closed beta: registration is by invitation and features may change, move or be removed without notice. We may end the beta or limit access at any time."),
    ] },
    { heading: msg("Your account"), paragraphs: [
      msg("You must give a working e-mail address, keep your password secret and tell us if you think someone else has access to your account. You are responsible for what happens under your account."),
      msg("One person per account. You must be old enough to enter into a binding agreement where you live."),
    ] },
    { heading: msg("Your data"), paragraphs: [
      msg("The trades, notes, screenshots and settings you add remain yours. You give us only the permission needed to store and process them to run the service for you."),
      msg("You can export your data and delete your account at any time in Settings. How we handle personal data is described in the Privacy Policy."),
    ] },
    { heading: msg("Acceptable use"), paragraphs: [
      msg("Do not try to access other users' data, probe or overload the service, bypass limits or security, upload malware or content you have no right to, or use the service for anything unlawful. We may suspend accounts that do."),
    ] },
    { heading: msg("MT5 Bridge"), paragraphs: [
      msg("MT5 Bridge is an optional program for your own computer. It reads the trade history of a terminal you have already opened and sends it to your journal. You install and run it at your own discretion and can disconnect it at any time."),
    ] },
    { heading: msg("Availability and accuracy"), paragraphs: [
      msg("We work to keep the service available and the calculations correct, but the service is provided \"as is\" without guarantees. Numbers in the journal depend on the data you or your broker supply; check important figures against your broker's statements."),
    ] },
    { heading: msg("Liability"), paragraphs: [
      msg("To the extent the law allows, we are not liable for trading losses, lost profit or decisions you make based on the service. Nothing in these terms limits liability that cannot be limited by law."),
    ] },
    { heading: msg("Changes and ending"), paragraphs: [
      msg("We may update these terms; the date at the top shows the current version, and important changes will be announced in the app. You may stop using the service and delete your account at any time."),
      msg("These terms are governed by the law of {jurisdiction}."),
    ] },
  ],
};

const privacy: LegalDocument = {
  slug: "privacy", title: msg("Privacy Policy"), updated: "2026-11-19",
  summary: msg("What personal data Trade Vault collects, why, who processes it and what you can do about it."),
  sections: [
    { heading: msg("Who is responsible"), paragraphs: [
      msg("The controller of your personal data is {operator}. Questions and requests: {contact}."),
    ] },
    { heading: msg("What we collect"), paragraphs: [
      msg("Account: your e-mail address, a password hash (we never see the password itself), the name you set and, if you sign in with Google, your Google name and avatar."),
      msg("Journal: trading accounts, trades, notes, tags, screenshots, strategies, goals and settings that you add yourself or that MT5 Bridge sends from your terminal."),
      msg("Security: sign-in events and security changes, with the IP address stored only as a one-way hash, and the list of computers connected to MT5 Bridge."),
      msg("Technical: error reports when something breaks, with e-mail addresses, tokens, long numbers, cookies and request bodies removed before they leave the site."),
    ] },
    { heading: msg("Why we use it"), paragraphs: [
      msg("To run the service you asked for (the contract with you): store your journal, show your statistics, keep you signed in."),
      msg("To keep the service and your account secure and to fix errors (our legitimate interest)."),
      msg("We do not sell your data, do not use it for advertising and do not build profiles about you for anyone else."),
    ] },
    { heading: msg("Who processes it for us"), paragraphs: [
      msg("Supabase (database, sign-in and file storage), Vercel (hosting) and, when enabled, Sentry (error reports), Cloudflare Turnstile (bot check at sign-up and sign-in) and Google (if you choose to sign in with Google). They process data only to provide their service to us."),
      msg("Some of these providers may process data outside your country. Where that happens, we rely on the safeguards they offer, such as standard contractual clauses."),
    ] },
    { heading: msg("Who can see your journal"), paragraphs: [
      msg("Only you. Every request is limited to your own user on the server and again in the database. The administrator does not look into users' journals except when you ask for help or when needed to fix a fault or meet a legal obligation."),
    ] },
    { heading: msg("How long we keep it"), paragraphs: [
      msg("As long as your account exists. When you delete the account, your profile and all journal data are deleted straight away; copies in backups disappear when those backups expire. Security events are kept for a limited time to protect the account."),
    ] },
    { heading: msg("Your rights"), paragraphs: [
      msg("You can see and correct your data in the app, download all of it (Settings → Your data) and delete your account (Settings → Delete account). You can also ask us for access, correction, deletion, restriction or portability, object to processing, and complain to your data protection authority."),
    ] },
    { heading: msg("Changes"), paragraphs: [
      msg("When this policy changes, the date at the top changes too; important changes will be announced in the app."),
    ] },
  ],
};

const cookies: LegalDocument = {
  slug: "cookies", title: msg("Cookie Policy"), updated: "2026-11-19",
  summary: msg("Trade Vault uses only the cookies and browser storage it needs to work. No advertising or tracking cookies."),
  sections: [
    { heading: msg("Cookies"), paragraphs: [
      msg("Sign-in session (Supabase Auth): keeps you signed in. Secure and not readable by scripts on the page. Removed when you sign out."),
      msg("Password reset (vault_recovery): lets you set a new password after opening the reset e-mail. Short-lived."),
      msg("Language (mq_locale): remembers English or Ukrainian."),
      msg("These cookies are strictly necessary, so the law does not require consent for them. Cloudflare Turnstile, when enabled on the sign-in forms, may set its own cookies needed for the bot check."),
    ] },
    { heading: msg("Browser storage"), paragraphs: [
      msg("The browser also keeps a few settings locally so the page opens the way you left it: theme, the selected trading account, a copy of your settings, whether the sidebar is collapsed and which news in Help you have seen. They never leave your device and you can clear them in the browser at any time."),
    ] },
    { heading: msg("What we do not use"), paragraphs: [
      msg("No advertising, social-media or cross-site tracking cookies and no analytics that follow you across sites. If that ever changes, we will ask for your consent first."),
    ] },
  ],
};

const risk: LegalDocument = {
  slug: "risk-disclosure", title: msg("Risk disclosure"), updated: "2026-11-19",
  summary: msg("Trading carries a high risk of loss. Trade Vault is a journal, not investment advice."),
  sections: [
    { heading: msg("Trading is risky"), paragraphs: [
      msg("Trading foreign exchange, CFDs, futures, crypto assets and other leveraged products carries a high risk of losing money quickly. You can lose more than you expect, and with some products more than your deposit. Only trade with money you can afford to lose."),
    ] },
    { heading: msg("Not advice"), paragraphs: [
      msg("Everything in Trade Vault — statistics, R values, rule checks, calendars, prop-account progress — describes your own past trades or public information. It is not investment, financial or tax advice and not a recommendation to trade."),
    ] },
    { heading: msg("Past results"), paragraphs: [
      msg("Past performance, including your own journal statistics, does not guarantee future results. A positive expectancy over a sample of trades can change."),
    ] },
    { heading: msg("Prop firms and brokers"), paragraphs: [
      msg("Trade Vault is not affiliated with any broker or prop firm. Their rules, statements and decisions take precedence over anything shown here; always check limits and results with them."),
    ] },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocument["slug"], LegalDocument> = { terms, privacy, cookies, "risk-disclosure": risk };
export const LEGAL_LINKS: { slug: LegalDocument["slug"]; label: string }[] = [
  { slug: "terms", label: msg("Terms of Use") },
  { slug: "privacy", label: msg("Privacy Policy") },
  { slug: "cookies", label: msg("Cookie Policy") },
  { slug: "risk-disclosure", label: msg("Risk disclosure") },
];
