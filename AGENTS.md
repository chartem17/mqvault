# Agents

Project rules live in [`CLAUDE.md`](CLAUDE.md); read it first.

## ui-sdk

Before using ui-sdk (`@ui-sdk/react`, `@ui-sdk/core`):

- follow the `ui-sdk` skill if it is installed;
- read `node_modules/@ui-sdk/react/docs/llms.txt`.

To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading, and read `rendering.md` next to it.

The default styles (`@ui-sdk/core/web.css`) are imported once in `src/app/layout.tsx`, before our own CSS.
