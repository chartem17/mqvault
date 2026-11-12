import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Inter, Unbounded } from "next/font/google";
// ui-sdk defaults first: its `ui-sdk` cascade layer is then the lowest, so our tokens and Tailwind win.
import "@ui-sdk/core/web.css";
import "./globals.css";
import "./typography.css";
import "./ui-finish.css";
import { AppBackdrop } from "@/components/layout/app-backdrop";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TradesProvider } from "@/hooks/use-trades";
import { UndoProvider } from "@/components/ui/undo-toast";
import { TimezoneProvider } from "@/components/providers/timezone-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n/core";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-home-display", display: "swap" });
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = { title: "Trade Vault", description: "Personal trading journal & macro workspace" };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  // Per-request CSP nonce from the middleware: next-themes injects an inline script that must carry it.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = isLocale(saved) ? saved : DEFAULT_LOCALE;
  return <html lang={locale} className={`${inter.variable} ${unbounded.variable}`} suppressHydrationWarning><body style={{ margin: 0, minHeight: "100dvh" }}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange nonce={nonce}>
      <AppBackdrop />
      <I18nProvider initialLocale={locale}><ProfileProvider><PreferencesProvider><TimezoneProvider><UndoProvider><TradesProvider>{children}</TradesProvider></UndoProvider></TimezoneProvider></PreferencesProvider></ProfileProvider></I18nProvider>
    </ThemeProvider>
  </body></html>;
}
