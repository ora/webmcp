import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createWebMcpBridge } from "../src/index.js";
import type { ModelContextLike, ModelContextTool } from "../src/types.js";

/**
 * In-memory ModelContext capturing registrations, enforcing the spec's
 * registration contract the way the browser would: unique names, ASCII
 * [a-zA-Z0-9_.-] names of 1-128 chars, non-empty descriptions.
 */
function fakeModelContext() {
  const tools = new Map<string, ModelContextTool>();
  const mc: ModelContextLike = {
    async registerTool(tool, options) {
      if (tools.has(tool.name)) {
        throw new DOMException(`duplicate tool ${tool.name}`, "InvalidStateError");
      }
      if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name)) {
        throw new DOMException(`invalid tool name ${tool.name}`, "InvalidStateError");
      }
      if (!tool.description) {
        throw new DOMException(`empty description for ${tool.name}`, "InvalidStateError");
      }
      tools.set(tool.name, tool);
      options?.signal?.addEventListener("abort", () => tools.delete(tool.name));
    },
  };
  return { mc, tools };
}

async function makeServer() {
  const server = new McpServer({ name: "test-server", version: "1.0.0" });
  server.registerTool(
    "get_weather",
    {
      description: "Get the weather for a city.",
      inputSchema: { city: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ city }) => ({
      content: [{ type: "text", text: `sunny in ${city}` }],
      structuredContent: { city, forecast: "sunny" },
    }),
  );
  server.registerTool(
    "delete_everything",
    { description: "Dangerous tool." },
    async () => ({ content: [{ type: "text", text: "boom" }] }),
  );
  server.registerTool(
    "always_fails",
    { description: "Returns an MCP error result." },
    async () => ({
      content: [{ type: "text", text: "upstream exploded" }],
      isError: true,
    }),
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  return { server, clientTransport };
}

describe("createWebMcpBridge", () => {
  it("registers remote tools with mapped annotations", async () => {
    const { clientTransport } = await makeServer();
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    expect([...tools.keys()].sort()).toEqual([
      "always_fails",
      "delete_everything",
      "get_weather",
    ]);
    const weather = tools.get("get_weather")!;
    expect(weather.description).toBe("Get the weather for a city.");
    expect(weather.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(tools.get("delete_everything")!.annotations).toEqual({
      readOnlyHint: false,
      untrustedContentHint: false,
    });
    expect(bridge.tools.map((t) => t.remoteName).sort()).toEqual([
      "always_fails",
      "delete_everything",
      "get_weather",
    ]);
    await bridge.close();
  });

  it("executes through the MCP server and prefers structuredContent", async () => {
    const { clientTransport } = await makeServer();
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    const result = await tools.get("get_weather")!.execute({ city: "Lisbon" });
    expect(result).toEqual({ city: "Lisbon", forecast: "sunny" });
    await bridge.close();
  });

  it("returns MCP error results as { error } instead of throwing", async () => {
    const { clientTransport } = await makeServer();
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    await expect(tools.get("always_fails")!.execute({})).resolves.toEqual({
      error: "upstream exploded",
    });
    await bridge.close();
  });

  it("applies include/exclude filters and namePrefix", async () => {
    const { clientTransport } = await makeServer();
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({
      transport: clientTransport,
      modelContext: mc,
      include: ["get_weather", "delete_everything"],
      exclude: ["delete_everything"],
      namePrefix: "acme.",
    });

    expect([...tools.keys()]).toEqual(["acme.get_weather"]);
    expect(bridge.tools).toEqual([
      {
        name: "acme.get_weather",
        remoteName: "get_weather",
        description: "Get the weather for a city.",
      },
    ]);
    await bridge.close();
  });

  it("unregisters everything on close", async () => {
    const { clientTransport } = await makeServer();
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    expect(tools.size).toBe(3);
    await bridge.close();
    expect(tools.size).toBe(0);
    expect(bridge.active).toBe(false);
  });

  it.each([false, true])(
    "closes the connection when initial discovery fails (close rejects: %s)",
    async (closeRejects) => {
      const { server, clientTransport } = await makeServer();
      server.server.setRequestHandler(ListToolsRequestSchema, () => {
        throw new Error("initial tools/list failed");
      });
      const originalClose = clientTransport.close.bind(clientTransport);
      const close = vi.spyOn(clientTransport, "close");
      if (closeRejects) {
        close.mockImplementationOnce(async () => {
          await originalClose();
          throw new Error("transport cleanup failed");
        });
      }
      const { mc, tools } = fakeModelContext();

      try {
        await expect(
          createWebMcpBridge({ transport: clientTransport, modelContext: mc }),
        ).rejects.toThrow("initial tools/list failed");
        expect(close).toHaveBeenCalled();
        await expect(
          clientTransport.send({ jsonrpc: "2.0", method: "notifications/initialized" }),
        ).rejects.toThrow("Not connected");
        expect(tools.size).toBe(0);
      } finally {
        close.mockRestore();
        await originalClose();
        await server.close();
      }
    },
  );

  it("unregisters partial tools when an initialization error handler throws", async () => {
    const { server, clientTransport } = await makeServer();
    const { mc, tools } = fakeModelContext();
    const registerTool = mc.registerTool.bind(mc);
    const registrationError = new Error("tool registration failed");
    mc.registerTool = async (tool, options) => {
      if (tool.name === "delete_everything") throw registrationError;
      await registerTool(tool, options);
    };
    const close = vi.spyOn(clientTransport, "close");

    try {
      await expect(
        createWebMcpBridge({
          transport: clientTransport,
          modelContext: mc,
          onRegisterError: (_name, error) => {
            throw error;
          },
        }),
      ).rejects.toBe(registrationError);
      expect(tools.size).toBe(0);
      expect(close).toHaveBeenCalled();
    } finally {
      close.mockRestore();
      await clientTransport.close();
      await server.close();
    }
  });

  it("re-syncs when the server's tool list changes", async () => {
    const { server, clientTransport } = await makeServer();
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    expect(tools.size).toBe(3);
    server.registerTool(
      "book_table",
      { description: "Book a table." },
      async () => ({ content: [{ type: "text", text: "booked" }] }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tools.has("book_table")).toBe(true);
    expect(tools.size).toBe(4);
    await bridge.close();
  });

  it("unwraps text-only MCP content when there is no structuredContent", async () => {
    const { clientTransport } = await makeServer();
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    // delete_everything returns content: [{ type: "text", text: "boom" }]
    // and no structuredContent; agents should get the text, not the MCP
    // content-block envelope.
    const result = await tools.get("delete_everything")!.execute({});
    expect(result).toBe("boom");
    await bridge.close();
  });

  it("refuses non-text MCP content instead of leaking the envelope", async () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    server.registerTool(
      "get_chart",
      { description: "Returns an image." },
      async () => ({
        content: [
          { type: "text", text: "here you go" },
          { type: "image", data: "aGk=", mimeType: "image/png" },
        ],
      }),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    await expect(tools.get("get_chart")!.execute({})).resolves.toEqual({
      error: expect.stringMatching(/non-text content \(image\)/) as unknown,
    });
    await bridge.close();
  });

  it("sanitizes MCP tool names that are illegal in WebMCP", async () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    server.registerTool(
      "files/list",
      { description: "List files." },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    expect([...tools.keys()]).toEqual(["files_list"]);
    expect(bridge.tools).toEqual([
      { name: "files_list", remoteName: "files/list", description: "List files." },
    ]);
    await bridge.close();
  });

  it("deduplicates sanitized names that collide", async () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    server.registerTool(
      "files/list",
      { description: "List files." },
      async () => ({ content: [{ type: "text", text: "slash" }] }),
    );
    server.registerTool(
      "files_list",
      { description: "List files, underscore flavor." },
      async () => ({ content: [{ type: "text", text: "underscore" }] }),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    expect(tools.size).toBe(2);
    expect(bridge.tools.map((t) => t.remoteName).sort()).toEqual([
      "files/list",
      "files_list",
    ]);
    const names = bridge.tools.map((t) => t.name);
    expect(new Set(names).size).toBe(2);
    for (const name of names) expect(name).toMatch(/^[a-zA-Z0-9_.-]{1,128}$/);
    await bridge.close();
  });

  it("clamps over-long tool names to 128 chars", async () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    server.registerTool(
      `list_${"x".repeat(140)}`,
      { description: "Very long name." },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    expect(tools.size).toBe(1);
    const [name] = [...tools.keys()];
    expect(name.length).toBe(128);
    expect(name.startsWith("list_xxx")).toBe(true);
    await bridge.close();
  });

  it("falls back to title, then a generated description, when the MCP tool has none", async () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    server.registerTool(
      "titled_only",
      { title: "Titled Tool" },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    server.registerTool(
      "bare_tool",
      {},
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const { mc, tools } = fakeModelContext();
    const bridge = await createWebMcpBridge({ transport: clientTransport, modelContext: mc });

    expect(tools.size).toBe(2);
    expect(tools.get("titled_only")!.description).toBe("Titled Tool");
    const bare = tools.get("bare_tool")!.description;
    expect(bare.length).toBeGreaterThan(0);
    expect(bare).toContain("bare_tool");
    await bridge.close();
  });

  it("returns an inert bridge when no ModelContext exists", async () => {
    const { clientTransport } = await makeServer();
    const bridge = await createWebMcpBridge({ transport: clientTransport });
    expect(bridge.active).toBe(false);
    expect(bridge.tools).toEqual([]);
    await bridge.close();
  });
});
