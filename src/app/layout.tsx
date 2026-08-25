import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TradeProvider } from "@/hooks/use-trades";

export const metadata: Metadata = {
  title: "Trade Vault",
  description: "Personal trading journal & macro workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=manrope@400,500,600,700,800&f[]=cabinet-grotesk@500,700,800&f[]=jet-brains-mono@400,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <TradeProvider>{children}</TradeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}