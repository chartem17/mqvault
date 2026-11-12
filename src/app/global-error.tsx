"use client";

/**
 * Last resort when the root layout itself fails: no providers, translations or theme are available here, so the
 * text is plain English (the dictionary cannot load) and the colours are inline.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#090b10", color: "#e6e8ea", fontFamily: "system-ui, sans-serif" }}>
    <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
      <p style={{ color: "#9aa3ab", fontSize: 14, lineHeight: 1.6 }}>Your data is safe. Try again or reload the page.</p>
      <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, background: "#2bb3a5", color: "#061012", fontWeight: 600, cursor: "pointer" }}>Try again</button>
    </main>
  </body></html>;
}
