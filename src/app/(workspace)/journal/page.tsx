"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JournalTab } from "@/components/tabs/journal-tab";
import { WorkspaceLoading } from "@/components/layout/workspace-loading";
import { parseJournalFocus } from "@/lib/journal/journal-focus";
import { tabPath } from "@/lib/navigation/workspace-routes";

/** The journal. Its views live in the address: `?review=1` day review, `?gallery=1` screenshots, `?focusTradeIds=` a filtered set. */
function JournalContent() {
  const router = useRouter();
  const search = useSearchParams();
  const focus = useMemo(() => parseJournalFocus(search), [search]);
  const review = search.get("review") === "1";
  const gallery = !review && search.get("gallery") === "1";
  const go = (change: (params: URLSearchParams) => void, replace = false) => {
    const params = new URLSearchParams(search.toString());
    change(params);
    const path = tabPath("journal", params);
    if (replace) router.replace(path, { scroll: false }); else router.push(path, { scroll: false });
  };
  return <JournalTab key={focus.kind === "ids" ? `ids:${focus.ids.join(",")}` : focus.kind} focus={focus}
    onClearFocus={() => go(params => params.delete("focusTradeIds"), true)}
    review={review} onReviewChange={open => go(params => { params.delete("gallery"); if (open) params.set("review", "1"); else params.delete("review"); })}
    gallery={gallery} onGalleryChange={open => go(params => { params.delete("review"); if (open) params.set("gallery", "1"); else params.delete("gallery"); })} />;
}

export default function JournalPage() {
  return <Suspense fallback={<WorkspaceLoading />}><JournalContent /></Suspense>;
}
