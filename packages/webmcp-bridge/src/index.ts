import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
  BridgedTool,
  ModelContextLike,
  ModelContextTool,
  WebMcpBridge,
  WebMcpBridgeOptions,
} from "./types.js";

export type {
  BridgedTool,
  McpTool,
  ModelContextExecuteOptions,
  ModelContextLike,
  ModelContextTool,
  WebMcpBridge,
  WebMcpBridgeOptions,
} from "./types.js";

const TAG = "[webmcp-bridge]";

function resolveModelContext(
  override?: ModelContextLike,
): ModelContextLike | null {
  if (override) return override;
  const mc =
    (typeof document !== "undefined" ? document.modelContext : undefined) ??
    (typeof navigator !== "undefined" ? navigator.modelContext : undefined);
  return mc && typeof mc.registerTool === "function" ? mc : null;
}

async function connect(options: WebMcpBridgeOptions): Promise<Client> {
  const client = new Client(
    options.clientInfo ?? { name: "@ora-ai/webmcp-bridge", version: "0.1.0" },
  );
  if (options.transport) {
    await client.connect(options.transport);
    return client;
  }
  if (!options.url) {
    throw new Error(`${TAG} either "url" or "transport" is required`);
  }
  const url = new URL(options.url);
  const requestInit = options.headers ? { headers: options.headers } : undefined;
  try {
    await client.connect(
      new StreamableHTTPClientTransport(url, requestInit ? { requestInit } : undefined),
    );
    return client;
  } catch {
    // Streamable HTTP failed; fall back to the legacy SSE transport.
  }
  await client.connect(
    new SSEClientTransport(url, requestInit ? { requestInit } : undefined),
  );
  return client;
}

async function listAllTools(client: Client): Promise<Tool[]> {
  const tools: Tool[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

function selectTools(tools: Tool[], options: WebMcpBridgeOptions): Tool[] {
  let selected = tools;
  if (options.include) {
    const include = new Set(options.include);
    selected = selected.filter((t) => include.has(t.name));
  }
  if (options.exclude) {
    const exclude = new Set(options.exclude);
    selected = selected.filter((t) => !exclude.has(t.name));
  }
  return selected;
}

// Failures are returned as { error }, never thrown: the spec maps a
// rejected execute to a bare UnknownError and discards the message.
function toResult(result: CallToolResult, toolName: string): unknown {
  if (result.isError) {
    const text = (result.content ?? [])
      .map((block) => ("text" in block ? block.text : ""))
      .filter(Boolean)
      .join("\n");
    return { error: text || `${toolName} failed on the MCP server.` };
  }
  if (result.structuredContent !== undefined) return result.structuredContent;
  const content = result.content ?? [];
  // Text-only results reach the agent as plain text; the raw MCP
  // content-block envelope is not a WebMCP shape, so non-text blocks are
  // refused rather than leaked.
  if (content.every((block) => block.type === "text")) {
    return content.map((block) => block.text).join("\n");
  }
  const types = [...new Set(content.filter((b) => b.type !== "text").map((b) => b.type))];
  return {
    error:
      `${toolName} returned non-text content (${types.join(", ")}) that has no ` +
      "WebMCP result shape. Add structuredContent on the MCP server or " +
      'exclude this tool via the bridge\'s "exclude" option.',
  };
}

/** WebMCP tool names: ASCII [a-zA-Z0-9_.-], 1-128 chars, unique per page. */
function toWebMcpName(raw: string, taken: ReadonlySet<string>): string {
  const base = raw.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 128) || "tool";
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = `_${i}`;
    const candidate = base.slice(0, 128 - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

/** WebMCP requires a non-empty description; MCP does not. */
function toWebMcpDescription(tool: Tool): string {
  return (
    tool.description?.trim() ||
    tool.title?.trim() ||
    `Bridged from the MCP server tool "${tool.name}".`
  );
}

function toDescriptor(
  client: Client,
  tool: Tool,
  registeredName: string,
): ModelContextTool {
  return {
    name: registeredName,
    description: toWebMcpDescription(tool),
    ...(tool.title ? { title: tool.title } : {}),
    ...(tool.inputSchema
      ? { inputSchema: tool.inputSchema as Record<string, unknown> }
      : {}),
    annotations: {
      readOnlyHint: tool.annotations?.readOnlyHint === true,
      // An open-world tool reaches beyond the server's own domain, so its
      // output can carry third-party content.
      untrustedContentHint: tool.annotations?.openWorldHint === true,
    },
    async execute(input, options) {
      const result = (await client.callTool(
        { name: tool.name, arguments: input ?? {} },
        undefined,
        options?.signal ? { signal: options.signal } : undefined,
      )) as CallToolResult;
      return toResult(result, tool.name);
    },
  };
}

/** Signature used to detect remote tool changes across list_changed re-syncs. */
function signatureOf(tool: Tool): string {
  return JSON.stringify([
    tool.description,
    tool.title,
    tool.inputSchema,
    tool.annotations,
  ]);
}

/**
 * Connect to a remote MCP server and register its tools on the page's
 * `document.modelContext` so in-browser agents can call them via WebMCP.
 *
 * Resolves to an inert bridge (with a one-time console warning) when the
 * browser exposes no ModelContext, so calling this never breaks the page.
 */
export async function createWebMcpBridge(
  options: WebMcpBridgeOptions,
): Promise<WebMcpBridge> {
  const mc = resolveModelContext(options.modelContext);
  if (!mc) {
    console.warn(
      `${TAG} no ModelContext in this browser; bridged tools were not registered. ` +
        "See https://webmachinelearning.github.io/webmcp/ for support status.",
    );
    return { tools: [], active: false, close: async () => {} };
  }

  const client = await connect(options);
  const prefix = options.namePrefix ?? "";
  // remoteName -> registration
  const registered = new Map<
    string,
    { controller: AbortController; signature: string; bridged: BridgedTool }
  >();
  let closed = false;

  async function close(): Promise<void> {
    if (closed) return;
    closed = true;
    for (const entry of registered.values()) entry.controller.abort();
    registered.clear();
    await client.close();
  }

  async function register(tool: Tool): Promise<void> {
    const taken = new Set(
      [...registered.values()].map((entry) => entry.bridged.name),
    );
    const name = toWebMcpName(`${prefix}${tool.name}`, taken);
    const controller = new AbortController();
    try {
      await mc!.registerTool(toDescriptor(client, tool, name), {
        signal: controller.signal,
      });
      if (closed) {
        controller.abort();
        return;
      }
      registered.set(tool.name, {
        controller,
        signature: signatureOf(tool),
        bridged: { name, remoteName: tool.name, description: toWebMcpDescription(tool) },
      });
    } catch (error) {
      controller.abort();
      if (options.onRegisterError) options.onRegisterError(tool.name, error);
      else console.error(`${TAG} failed to register "${name}":`, error);
    }
  }

  async function sync(): Promise<void> {
    if (closed) return;
    const remote = selectTools(await listAllTools(client), options);
    if (closed) return;
    const remoteNames = new Set(remote.map((t) => t.name));
    for (const [remoteName, entry] of registered) {
      if (!remoteNames.has(remoteName)) {
        entry.controller.abort();
        registered.delete(remoteName);
      }
    }
    for (const tool of remote) {
      const existing = registered.get(tool.name);
      if (existing && existing.signature === signatureOf(tool)) continue;
      if (existing) {
        existing.controller.abort();
        registered.delete(tool.name);
      }
      await register(tool);
    }
  }

  // Serialize syncs: notification handlers fire concurrently, and two
  // interleaved syncs would race on the shared registration map.
  let syncChain: Promise<void> = Promise.resolve();
  function scheduleSync(): Promise<void> {
    const run = syncChain.then(sync);
    syncChain = run.catch(() => {});
    return run;
  }

  if (options.followListChanges !== false) {
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
      void scheduleSync().catch((error) =>
        console.warn(`${TAG} re-sync after tools/list_changed failed:`, error),
      );
    });
  }

  try {
    await scheduleSync();
  } catch (error) {
    // No bridge is returned on initialization failure, so the caller cannot
    // release its resources. Preserve the original error if cleanup fails too.
    await close().catch(() => {});
    throw error;
  }

  return {
    get tools() {
      return [...registered.values()].map((entry) => entry.bridged);
    },
    get active() {
      return !closed;
    },
    close,
  };
}
