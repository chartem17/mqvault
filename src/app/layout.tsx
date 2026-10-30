import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TradesProvider } from "@/hooks/use-trades";
import { UndoProvider } from "@/components/ui/undo-toast";
import { TimezoneProvider } from "@/components/providers/timezone-provider";

export const metadata: Metadata = { title: "Trade Vault", description: "Personal trading journal & macro workspace" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body style={{ margin: 0, minHeight: "100dvh", backgroundColor: "var(--page-bg)" }}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <TimezoneProvider><UndoProvider><TradesProvider>{children}</TradesProvider></UndoProvider></TimezoneProvider>
    </ThemeProvider>
  </body></html>;
}
