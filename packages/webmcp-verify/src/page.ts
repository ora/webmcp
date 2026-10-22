// Expressions evaluated inside the page over CDP. Derived from the
// self-contained functions in page-fns.ts via toString(), so the extension
// (which injects the functions directly) and the CLI share one page contract.
// Values are injected as JSON so tool names and inputs cannot break out.

import { readToolsInPage, runToolInPage } from "./page-fns.js";

export function listToolsExpression(): string {
  return `(${readToolsInPage.toString()})()`;
}

export function executeToolExpression(
  name: string,
  input: Record<string, unknown>,
): string {
  return `(${runToolInPage.toString()})(${JSON.stringify(name)}, ${JSON.stringify(input)})`;
}
