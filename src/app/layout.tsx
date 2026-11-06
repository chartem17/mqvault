import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Unbounded } from "next/font/google";
import "./globals.css";
import "./typography.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TradesProvider } from "@/hooks/use-trades";
import { UndoProvider } from "@/components/ui/undo-toast";
import { TimezoneProvider } from "@/components/providers/timezone-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n/core";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-home-display", display: "swap" });
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = { title: "Trade Vault", description: "Personal trading journal & macro workspace" };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : DEFAULT_LOCALE;
  return <html lang={locale} className={`${inter.variable} ${unbounded.variable}`} suppressHydrationWarning><body style={{ margin: 0, minHeight: "100dvh", backgroundColor: "var(--page-bg)" }}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <I18nProvider initialLocale={locale}><TimezoneProvider><UndoProvider><TradesProvider>{children}</TradesProvider></UndoProvider></TimezoneProvider></I18nProvider>
    </ThemeProvider>
  </body></html>;
}
