"use client";

import { useLivePrices, TickerData } from "@/hooks/use-live-prices";
import { TrendingUp, TrendingDown, Minus, Zap, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Тільки активи з твого журналу
const SYMBOLS = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "EUR/USD",
  "GBP/USD",
  "XAU/USD",
  "XAG/USD",
];

const MARKET: Record<string, string> = {
  "BTC/USDT": "Crypto",
  "ETH/USDT": "Crypto",
  "SOL/USDT": "Crypto",
  "EUR/USD":  "Forex",
  "GBP/USD":  "Forex",
  "XAU/USD":  "Metals",
  "XAG/USD":  "Metals",
};

const MARKET_COLOR: Record<string, string> = {
  "Crypto": "text-purple-400",
  "Forex":  "text-blue-400",
  "Metals": "text-yellow-400",
};

function fmtPrice(sym: string, price: number): string {
  if (!price) return "—";
  if (sym === "BTC/USDT")
    return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (["ETH/USDT", "SOL/USDT"].includes(sym))
    return "$" + price.toFixed(2);
  if (sym === "XAU/USD")
    return "$" + price.toFixed(2);
  if (sym === "XAG/USD")
    return "$" + price.toFixed(3);
  return price.toFixed(5);
}

function fmtChange(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function SourceIcon({ source }: { source: TickerData["source"] }) {
  if (source === "binance-ws" || source === "polygon-ws") {
    return (
      <span className="flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-green)] animate-pulse" />
        <span className="text-[9px] text-[var(--color-green)] font-mono">LIVE</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground">
      <RefreshCw className="w-2.5 h-2.5" />
      <span className="text-[9px] font-mono">30s</span>
    </span>
  );
}

function TickerRow({
  data,
  flash,
  isBest,
  isWorst,
}: {
  data: TickerData;
  flash: boolean;
  isBest: boolean;
  isWorst: boolean;
}) {
  const pos = data.change24h > 0;
  const neg = data.change24h < 0;

  const changeColor = pos
    ? "text-[var(--color-green)]"
    : neg
    ? "text-[var(--color-red)]"
    : "text-muted-foreground";

  const Icon = pos ? TrendingUp : neg ? TrendingDown : Minus;

  return (
    <div
      className={`
        flex items-center justify-between px-4 py-3
        border-b border-border/50 last:border-0
        transition-colors duration-200
        ${flash ? "bg-primary/5" : "hover:bg-secondary/30"}
      `}
    >
      {/* Left: symbol + market */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
          <Icon className={`w-3.5 h-3.5 ${changeColor}`} />
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold font-mono text-foreground">
              {data.symbol}
            </span>
            {isBest && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-green)]/10 text-[var(--color-green)] font-semibold">
                TOP
              </span>
            )}
            {isWorst && (
              <span className="text-[9px] px-1.5 py