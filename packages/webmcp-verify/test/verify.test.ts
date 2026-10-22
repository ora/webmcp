import { describe, expect, it } from "vitest";
import {
  executeTool,
  lintTools,
  listTools,
  type PageEvaluator,
  type VerifiedTool,
} from "../src/verify.js";
import { executeToolExpression, listToolsExpression } from "../src/page.js";
import { parseArgs } from "../src/cli-args.js";

function evaluatorReturning(value: unknown): PageEvaluator {
  return { evaluate: async () => value };
}

const cleanTool: VerifiedTool = {
  name: "search_books",
  description: "Search the catalog.",
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  inputSchema: { type: "object" },
};

describe("page expressions", () => {
  it("embeds the tool name and input as JSON so quotes cannot break out", () => {
    const expr = executeToolExpression('we"ird', { q: 'a"b' });
    expect(expr).toContain('"we\\"ird"');
    expect(expr).toContain('{"q":"a\\"b"}');
  });

  it("retries executeTool with a JSON-string input for current Chrome", () => {
    // Spec says inputObject is an object; Chrome ~151 only parses a JSON
    // string. The expression must try the object first, then the string.
    const expr = executeToolExpression("search_books", { q: 1 });
    const objectCall = expr.indexOf("mc.executeTool(tool, input)");
    const stringCall = expr.indexOf("mc.executeTool(tool, JSON.stringify(input))");
    expect(objectCall).toBeGreaterThanOrEqual(0);
    expect(stringCall).toBeGreaterThan(objectCall);
  });

  it("feature-detects document.modelContext before navigator", () => {
    const expr = listToolsExpression();
    expect(expr.indexOf("document.modelContext")).toBeGreaterThanOrEqual(0);
    expect(expr.indexOf("document.modelContext")).toBeLessThan(
      expr.indexOf("navigator.modelContext"),
    );
  });
});

describe("listTools", () => {
  it("returns the tools reported by the page", async () => {
    const tools = await listTools(evaluatorReturning({ tools: [cleanTool] }));
    expect(tools).toEqual([cleanTool]);
  });

  it("parses inputSchema when Chrome reports it as a JSON string", async () => {
    const tools = await listTools(
      evaluatorReturning({
        tools: [{ ...cleanTool, inputSchema: '{"type":"object"}' }],
      }),
    );
    expect(tools[0].inputSchema).toEqual({ type: "object" });
  });

  it("throws an actionable error when the page has no ModelContext", async () => {
    await expect(
      listTools(evaluatorReturning({ error: "no-modelcontext" })),
    ).rejects.toThrow(/WebMCP|flag|polyfill/i);
  });
});

describe("executeTool", () => {
  it("parses the JSON string executeTool resolves to", async () => {
    const result = await executeTool(
      evaluatorReturning({ raw: '{"matches":[]}' }),
      "search_books",
      {},
    );
    expect(result.raw).toBe('{"matches":[]}');
    expect(result.parsed).toEqual({ matches: [] });
  });

  it("keeps a non-JSON string result as-is", async () => {
    const result = await executeTool(
      evaluatorReturning({ raw: "plain text" }),
      "search_books",
      {},
    );
    expect(result.parsed).toBe("plain text");
  });

  it("lists registered names when the tool is not found", async () => {
    await expect(
      executeTool(
        evaluatorReturning({ error: "not-found", names: ["a", "b"] }),
        "missing",
        {},
      ),
    ).rejects.toThrow(/missing.*a, b/s);
  });

  it("surfaces execute exceptions as failures", async () => {
    await expect(
      executeTool(
        evaluatorReturning({ error: "execute-threw", message: "bad input" }),
        "search_books",
        {},
      ),
    ).rejects.toThrow("bad input");
  });
});

describe("lintTools", () => {
  it("passes a clean tool", () => {
    expect(lintTools([cleanTool])).toEqual([]);
  });

  it("flags illegal names, empty descriptions, and missing readOnlyHint", () => {
    const findings = lintTools([
      { name: "bad/name", description: "", annotations: null, inputSchema: null },
    ]);
    const texts = findings.map((f) => f.message).join("\n");
    expect(findings.filter((f) => f.tool === "bad/name")).toHaveLength(3);
    expect(texts).toMatch(/name/i);
    expect(texts).toMatch(/description/i);
    expect(texts).toMatch(/readOnlyHint/);
  });

  it("flags names over 128 chars", () => {
    const findings = lintTools([{ ...cleanTool, name: "x".repeat(129) }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/128/);
  });
});

describe("parseArgs", () => {
  it("parses url with defaults", () => {
    expect(parseArgs(["http://localhost:3000"])).toEqual({
      url: "http://localhost:3000",
      exec: undefined,
      input: {},
      json: false,
      headless: false,
      timeoutMs: 10000,
      chromeFlags: [],
    });
  });

  it("parses exec, input, json, headless, timeout, and extra chrome flags", () => {
    expect(
      parseArgs([
        "http://localhost:3000",
        "--exec",
        "search_books",
        "--input",
        '{"query":"x"}',
        "--json",
        "--headless",
        "--timeout",
        "5000",
        "--chrome-flag",
        "--no-sandbox",
      ]),
    ).toEqual({
      url: "http://localhost:3000",
      exec: "search_books",
      input: { query: "x" },
      json: true,
      headless: true,
      timeoutMs: 5000,
      chromeFlags: ["--no-sandbox"],
    });
  });

  it("rejects a missing url and malformed --input JSON", () => {
    expect(() => parseArgs([])).toThrow(/url/i);
    expect(() => parseArgs(["http://x", "--input", "{oops"])).toThrow(/--input/);
  });

  it("rejects --input without --exec", () => {
    expect(() => parseArgs(["http://x", "--input", "{}"])).toThrow(/--exec/);
  });
});
