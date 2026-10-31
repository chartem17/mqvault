# Shared UI foundation: integrated Spectral preview

Integrated foundation source: Claude PR #18, pinned commit 7046b2c. Target: feat/journal-layout-filters, retaining current journal and equal-height overview implementation. Only globals.css/layout.tsx change in app code.

Spectral SC (latin/cyrillic; weights 400/500/600/700) is loaded through next/font. Sans, mono and display utility aliases all use the approved Spectral SC family; mono is now a compatibility name, not a monospaced guarantee. Native controls and SVG labels use the same family. SC intentionally uses small caps. No forced uppercasing of stored text.

Original pre-Claude dark colour tokens and page background are retained. Claude radius scale, control focus, panel finish, scrollbars and reduced-motion support are integrated. Existing light-theme values are retained. This is not a full migration away from hardcoded colour utilities or inline fonts; audit remaining exceptions before declaring it complete.

No screen markup, financial formula, account scope or database changes. English/Ukrainian translation and language switch are not implemented by this font package. No production release.

Required visual acceptance: actual loaded font (not fallback), English/Ukrainian including Ґґ Єє Іі Її, symbols and numbers, both themes, mobile, forms, dropdowns, equal-height rows and Drawdown details. CI success is not browser acceptance.
