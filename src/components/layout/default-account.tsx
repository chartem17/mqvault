"use client";

import { useEffect, useRef } from "react";
import { useTrades } from "@/hooks/use-trades";
import { usePreferences } from "@/components/providers/preferences-provider";

const APPLIED_KEY = "mq_default_account_applied";

/** Settings → Default account: selected once per browser session when the site opens; switching later is not overridden. */
export function DefaultAccount() {
  const { accounts, setActiveAccountId } = useTrades();
  const { preferences, ready } = usePreferences();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ready || !accounts.length) return;
    done.current = true;
    const id = preferences.defaultAccountId;
    try { if (sessionStorage.getItem(APPLIED_KEY)) return; sessionStorage.setItem(APPLIED_KEY, "1"); } catch { /* storage blocked: apply anyway */ }
    if (id && accounts.some(account => account.id === id)) setActiveAccountId(id);
  }, [ready, accounts, preferences.defaultAccountId, setActiveAccountId]);
  return null;
}
