import { executeToolExpression, listToolsExpression } from "./page.js";

/** Anything that can evaluate an expression in the page and return its value. */
export interface PageEvaluator {
  evaluate(expression: string): Promise<unknown>;
}

export interface VerifiedTool {
  name: string;
  description: string;
  annotations: { readOnlyHint?: boolean; untrustedContentHint?: boolean } | null;
  inputSchema: Record<string, unknown> | null;
}

export interface ExecuteResult {
  /** The DOMString executeTool resolved to. */
  raw: string;
  /** `raw` JSON-parsed when possible, otherwise the raw string. */
  parsed: unknown;
}

export interface LintFinding {
  tool: string;
  message: string;
}

const NO_MODELCONTEXT_HELP =
  "The page exposes no ModelContext: WebMCP is not active in this browser. " +
  "Enable chrome://flags/#enable-webmcp-testing (or launch Chrome with " +
  "--enable-features=WebMCPTesting), or load " +
  "@mcp-b/webmcp-polyfill on the page.";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Unexpected page result: ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
}

/**
 * Normalize a raw page result from readToolsInPage/listToolsExpression.
 * Shared by the CLI (over CDP) and the workbench extension (executeScript).
 */
export function normalizeListResult(rawResult: unknown): VerifiedTool[] {
  const result = asRecord(rawResult);
  if (result.error === "no-modelcontext") throw new Error(NO_MODELCONTEXT_HELP);
  const tools = result.tools as (Omit<VerifiedTool, "inputSchema"> & {
    inputSchema: VerifiedTool["inputSchema"] | string;
  })[];
  // Current Chrome reports inputSchema as a JSON string; normalize to an object.
  return tools.map((tool) => {
    let schema = tool.inputSchema;
    if (typeof schema === "string") {
      try {
        schema = JSON.parse(schema) as Record<string, unknown>;
      } catch {
        schema = null;
      }
    }
    return { ...tool, inputSchema: schema };
  });
}

export async function listTools(evaluator: PageEvaluator): Promise<VerifiedTool[]> {
  return normalizeListResult(await evaluator.evaluate(listToolsExpression()));
}

/**
 * Normalize a raw page result from runToolInPage/executeToolExpression.
 * Shared by the CLI (over CDP) and the workbench extension (executeScript).
 */
export function normalizeExecuteResult(
  rawResult: unknown,
  name: string,
): ExecuteResult {
  const result = asRecord(rawResult);
  if (result.error === "no-modelcontext") throw new Error(NO_MODELCONTEXT_HELP);
  if (result.error === "not-found") {
    const names = (result.names as string[]).join(", ");
    throw new Error(
      `Tool "${name}" is not registered on this page. Registered tools: ${names || "(none)"}`,
    );
  }
  if (result.error === "execute-threw") {
    throw new Error(`Tool "${name}" threw: ${String(result.message)}`);
  }
  const raw = String(result.raw);
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // executeTool resolves to a DOMString; not all implementations JSON-encode.
  }
  return { raw, parsed };
}

export async function executeTool(
  evaluator: PageEvaluator,
  name: string,
  input: Record<string, unknown>,
): Promise<ExecuteResult> {
  return normalizeExecuteResult(
    await evaluator.evaluate(executeToolExpression(name, input)),
    name,
  );
}

const LEGAL_NAME = /^[a-zA-Z0-9_.-]+$/;

/** Static checks mirroring the verify skill's security-lint rung. */
export function lintTools(tools: VerifiedTool[]): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const tool of tools) {
    if (!LEGAL_NAME.test(tool.name)) {
      findings.push({
        tool: tool.name,
        message: "name has characters outside [a-zA-Z0-9_.-]",
      });
    }
    if (tool.name.length < 1 || tool.name.length > 128) {
      findings.push({ tool: tool.name, message: "name must be 1-128 chars" });
    }
    if (!tool.description.trim()) {
      findings.push({ tool: tool.name, message: "description is empty" });
    }
    if (typeof tool.annotations?.readOnlyHint !== "boolean") {
      findings.push({
        tool: tool.name,
        message: "annotations.readOnlyHint not set; agents cannot tell reads from writes",
      });
    }
  }
  return findings;
}
