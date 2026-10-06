import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * WebMCP tool execute options per the spec: `signal` is required
 * (`required AbortSignal signal` in the IDL). Pre-153 Chrome previews may
 * still invoke `execute` without options, hence the optional parameter on
 * `ModelContextTool.execute`.
 */
export interface ModelContextExecuteOptions {
  signal: AbortSignal;
}

/** WebMCP tool descriptor per https://webmachinelearning.github.io/webmcp/ */
export interface ModelContextTool {
  name: string;
  description: string;
  title?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
    consequentialHint?: boolean;
    debugging?: boolean;
  };
  execute: (
    input: Record<string, unknown>,
    options?: ModelContextExecuteOptions,
  ) => unknown | Promise<unknown>;
}

/** Minimal surface of the browser ModelContext object this bridge relies on. */
export interface ModelContextLike {
  registerTool(
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ): Promise<void> | void;
}

declare global {
  interface Document {
    modelContext?: ModelContextLike;
  }
  interface Navigator {
    /** @deprecated Legacy surface (pre-Chrome-150). Prefer document.modelContext. */
    modelContext?: ModelContextLike;
  }
}

export interface WebMcpBridgeOptions {
  /** URL of the remote MCP server (Streamable HTTP, with SSE fallback). */
  url?: string;
  /** Extra headers sent on every request to the MCP server (e.g. Authorization). */
  headers?: Record<string, string>;
  /**
   * Bring your own transport (custom auth, testing). When set, `url` and
   * `headers` are ignored.
   */
  transport?: Transport;
  /** Only bridge these tool names (server-side names, before prefixing). */
  include?: string[];
  /** Never bridge these tool names. Applied after `include`. */
  exclude?: string[];
  /** Prefix for registered tool names, e.g. "acme." to namespace bridged tools. */
  namePrefix?: string;
  /**
   * Follow the server's tools/list_changed notifications and re-sync
   * registrations. Default true.
   */
  followListChanges?: boolean;
  /** Client identity reported to the MCP server. */
  clientInfo?: { name: string; version: string };
  /** Called when a single tool fails to register (others still register). */
  onRegisterError?: (toolName: string, error: unknown) => void;
  /**
   * ModelContext override for tests or embedding; defaults to
   * document.modelContext with a navigator.modelContext fallback.
   */
  modelContext?: ModelContextLike;
}

export interface BridgedTool {
  /** Name registered on the page (after namePrefix). */
  name: string;
  /** Name on the MCP server. */
  remoteName: string;
  description: string;
}

export interface WebMcpBridge {
  /** Currently registered bridged tools. */
  readonly tools: BridgedTool[];
  /** True when a ModelContext was found and the MCP connection is open. */
  readonly active: boolean;
  /** Unregister all bridged tools and close the MCP connection. */
  close(): Promise<void>;
}

export type { Tool as McpTool };
