# @ora-ai/webmcp-verify

Verify a page's WebMCP tools from the terminal. Launches your installed
Chrome with the WebMCP preview flags, opens the URL, lists every tool
registered on `document.modelContext`, lints the registrations, and can
execute a tool exactly the way an agent would (`getTools` +
`executeTool`). No Canary, no manual flags, no console pasting.

Part of the [webmcp plugin](https://github.com/ora/webmcp) by
[Ora](https://ora.ai). MIT.

## Use

```
npx @ora-ai/webmcp-verify http://localhost:3000
```

Lists registered tools and lint findings (missing `readOnlyHint`, empty
descriptions, illegal names). Execute a tool:

```
npx @ora-ai/webmcp-verify http://localhost:3000 \
  --exec search_books --input '{"query":"dune"}'
```

Options: `--json` (machine-readable report), `--headless`,
`--timeout <ms>` (page settle, default 10000), `--chrome-flag <flag>`
(repeatable). Exit codes: 0 clean, 1 lint findings or failed execution,
2 could not run (no Chrome, page unreachable, no ModelContext).

## Requirements

- Chrome installed (a current stable; the CLI launches it with
  `--enable-features=WebMCPTesting,DevToolsWebMCPSupport`).
- A locally reachable page. State-changing tools should only be executed
  against local or seeded data.

## Library use

```js
import { openPage, listTools, executeTool, lintTools } from "@ora-ai/webmcp-verify";

const session = await openPage("http://localhost:3000");
const tools = await listTools(session);
const { parsed } = await executeTool(session, "search_books", { query: "dune" });
await session.close();
```

`listTools`/`executeTool` accept any `PageEvaluator` (an object with an
`evaluate(expression)` method), so they also run over an existing CDP or
Playwright session.

## License

MIT
