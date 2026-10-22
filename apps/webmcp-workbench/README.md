# WebMCP Workbench

Chrome side-panel devtools for [WebMCP](https://github.com/webmachinelearning/webmcp)
pages: **inspect** a page's registered tools (schemas, annotations), **run**
them through schema-driven forms, and **audit** them with the same lint rules
as the [`webmcp-verify` CLI](../../packages/webmcp-verify).

Built on `@ora-ai/webmcp-verify`: the panel injects that package's
self-contained page functions into the page's MAIN world via
`chrome.scripting.executeScript` — CSP-proof (no eval anywhere), no content
scripts, no message bridge. The CLI evaluates the same functions over CDP, so
both tools share one page contract.

## Build & install

```sh
npm install
npm run build        # builds ../../packages/webmcp-verify first, emits dist/
```

Then `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `apps/webmcp-workbench/dist`. Click the toolbar icon to open the panel.

## WebMCP enablement

`document.modelContext` exists only when WebMCP is on. Chrome 152+ ships it
enabled by default; on Chrome 151 turn on `chrome://flags/#enable-webmcp-testing`
or launch with `--enable-features=WebMCPTesting`. Pages can also load
`@mcp-b/webmcp-polyfill`. Without any of these the panel shows a red
"WebMCP: not detected" state with the same guidance.

## Try it on the bookshop fixture

```sh
npx serve ../../tests/fixtures/bookshop
```

Open the served `index.html` → the panel auto-scans and shows `search_books`
(read-only). `book.html` registers `add_to_cart`.

## Automated E2E

```sh
npm run e2e          # see scripts/e2e.mjs for the CHROME_PATH requirement
```

Serves the fixture, launches Chrome with the built extension, opens the real
side panel, and drives Inspect → Run → Audit plus the not-detected state.

## Development

`npm run dev` starts Vite with @crxjs HMR (load `dist/` unpacked once; the
panel hot-reloads). Note: `vite.config.ts` pins `build.target: "esnext"` —
down-leveling would break the injected functions' serialization; don't lower it.
