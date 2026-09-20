import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TradeProvider } from "@/hooks/use-trades";

export const metadata: Metadata = {
  title: "Trade Vault",
  description: "Personal trading journal & macro workspace",
};

const themeBootstrap = `(() => {
  try {
    const stored = localStorage.getItem("theme");
    const light = stored === "light";
    const root = document.documentElement;
    root.classList.toggle("light", light);
    root.classList.remove("dark");
    root.style.colorScheme = light ? "light" : "dark";
    root.style.backgroundColor = light ? "#f7f7f5" : "#090b10";
    document.body && (document.body.style.backgroundColor = light ? "#f7f7f5" : "#090b10");
  } catch {
    document.documentElement.classList.remove("light");
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.style.backgroundColor = "#090b10";
  }
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning style={{ backgroundColor: "#090b10", colorScheme: "dark" }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <meta name="theme-color" content="#090b10" />
        <link href="https://api.fontshare.com/v2/css?f[]=manrope@400,500,600,700,800&f[]=cabinet-grotesk@500,700,800&f[]=jet-brains-mono@400,700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, minHeight: "100dvh", backgroundColor: "#090b10" }}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TradeProvider>{children}</TradeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
