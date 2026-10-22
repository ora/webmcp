// The entire page interaction. The self-contained functions from page-fns are
// injected into the page's MAIN world (where document.modelContext lives) as
// real functions — CSP-proof, no content scripts, no eval. Import ONLY the
// ./page-fns and ./verify subpaths: the package root re-exports chrome.ts,
// which pulls Node-only chrome-launcher/chrome-remote-interface.
import { readToolsInPage, runToolInPage } from "@ora-ai/webmcp-verify/page-fns";
import {
  normalizeExecuteResult,
  normalizeListResult,
  type ExecuteResult,
  type VerifiedTool,
} from "@ora-ai/webmcp-verify/verify";

export type { ExecuteResult, VerifiedTool };
export { lintTools, type LintFinding } from "@ora-ai/webmcp-verify/verify";

export async function scanTools(tabId: number): Promise<VerifiedTool[]> {
  const [inj] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: readToolsInPage,
  });
  return normalizeListResult(inj.result);
}

export async function runTool(
  tabId: number,
  name: string,
  input: Record<string, unknown>,
): Promise<ExecuteResult> {
  const [inj] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: runToolInPage,
    args: [name, input],
  });
  return normalizeExecuteResult(inj.result, name);
}
