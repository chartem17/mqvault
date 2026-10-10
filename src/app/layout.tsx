import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TradesProvider } from "@/hooks/use-trades";

export const metadata: Metadata = {
  title: "Trade Vault",
  description: "Personal trading journal & macro workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={{ margin: 0, minHeight: "100dvh", backgroundColor: "#090b10" }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TradesProvider>{children}</TradesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
