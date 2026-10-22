// Functions that run inside the inspected page's MAIN JS world.
//
// They must stay fully self-contained — no imports, no module-scope helpers,
// no enums — because they travel as source: chrome.scripting.executeScript
// serializes the function itself, and page.ts derives the CDP expression
// strings from the same source via toString(). Only page globals
// (document/navigator/JSON) may be referenced. Type-only declarations below
// are erased at compile time and are therefore safe.

interface PageTool {
  name: string;
  description?: string;
  annotations?: unknown;
  inputSchema?: unknown;
}

interface ModelContext {
  getTools(): Promise<PageTool[]>;
  executeTool(tool: PageTool, input: unknown): Promise<string>;
}

declare const document: { modelContext?: ModelContext };
declare const navigator: { modelContext?: ModelContext };

/** List the page's WebMCP tools; `{error:"no-modelcontext"}` when absent. */
export async function readToolsInPage(): Promise<unknown> {
  const mc = document.modelContext ?? navigator.modelContext;
  if (!mc) return { error: "no-modelcontext" };
  const tools = await mc.getTools();
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      annotations: t.annotations
        ? JSON.parse(JSON.stringify(t.annotations))
        : null,
      inputSchema: (() => {
        try {
          return t.inputSchema ? JSON.parse(JSON.stringify(t.inputSchema)) : null;
        } catch {
          return null;
        }
      })(),
    })),
  };
}

/** Execute one tool by name; `{raw}` on success, `{error:...}` otherwise. */
export async function runToolInPage(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const mc = document.modelContext ?? navigator.modelContext;
  if (!mc) return { error: "no-modelcontext" };
  const tools = await mc.getTools();
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { error: "not-found", names: tools.map((t) => t.name) };
  // Spec: inputObject is an object. Chrome ~151 only parses a JSON string;
  // try the spec shape first, then fall back for current previews.
  try {
    const raw = await mc.executeTool(tool, input);
    return { raw };
  } catch (specShapeError) {
    try {
      const raw = await mc.executeTool(tool, JSON.stringify(input));
      return { raw };
    } catch {
      return {
        error: "execute-threw",
        message: String(
          ((specShapeError as { message?: unknown } | null)?.message) ??
            specShapeError,
        ),
      };
    }
  }
}
