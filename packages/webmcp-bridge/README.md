# @ora-ai/webmcp-bridge

Bridge a remote MCP server into the page. The bridge connects to your MCP
endpoint from the browser, discovers its tools, and registers each one on
`document.modelContext`, so in-browser AI agents can call the tools you
already ship. Built on the official `@modelcontextprotocol/sdk`. MIT.

Part of the [webmcp plugin](https://github.com/ora/webmcp) by
[ora](https://ora.ai).

## Install

```
npm install @ora-ai/webmcp-bridge
```

## Use

```js
import { createWebMcpBridge } from "@ora-ai/webmcp-bridge";

const bridge = await createWebMcpBridge({
  url: "https://mcp.example.com/mcp",
  headers: { Authorization: `Bearer ${token}` }, // if your server needs it
  include: ["search_products", "get_order_status"], // curate what you expose
  namePrefix: "acme.", // optional; avoids clashes with page tools
});

bridge.tools;         // what got registered
await bridge.close(); // unregister everything and disconnect
```

React (renders nothing; mount once near the root):

```jsx
import { WebMcpBridgeProvider } from "@ora-ai/webmcp-bridge/react";

<WebMcpBridgeProvider url="https://mcp.example.com/mcp" />
```

Vue:

```js
import { useWebMcpBridge } from "@ora-ai/webmcp-bridge/vue";

useWebMcpBridge({ url: "https://mcp.example.com/mcp" });
```

## Behavior

- Transports: Streamable HTTP first, legacy SSE fallback. Or pass your
  own `transport` (custom auth, testing).
- Tool discovery follows pagination and, by default, the server's
  `tools/list_changed` notifications; registrations re-sync live.
- MCP annotations map to WebMCP hints: `readOnlyHint` passes through;
  `openWorldHint` sets `untrustedContentHint`.
- Names and descriptions are made WebMCP-legal: names outside
  `[a-zA-Z0-9_.-]` are sanitized (and clamped to 128 chars, deduplicated on
  collision); a missing description falls back to the tool's title, then a
  generated line.
- Results unwrap for agents: `structuredContent` when the server sends it,
  otherwise text-only `content` joins to a plain string; MCP error results
  (`isError: true`) come back as `{ error }` payloads, so agents get an
  actionable failure — a thrown error would reach them as a bare
  `UnknownError` with the message discarded.
- Browsers without WebMCP get a console warning and an inert bridge; the
  page keeps working.

## Requirements

- Your MCP server must allow CORS from the page's origin; the browser
  calls it directly.
- WebMCP in the browser: Chrome behind
  `chrome://flags/#enable-webmcp-testing`, or a polyfill.
- Authorization stays your server's job. The bridge adds none.

## License

MIT
