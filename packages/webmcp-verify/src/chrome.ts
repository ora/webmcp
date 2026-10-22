import { launch } from "chrome-launcher";
import CDP from "chrome-remote-interface";
import type { PageEvaluator } from "./verify.js";

/**
 * Chrome flags that turn WebMCP on in current preview builds. Chrome 152
 * dropped DevToolsWebMCPSupport, and its presence invalidates the whole
 * --enable-features list there; WebMCPTesting alone works on 151 and 152
 * (both verified empirically).
 */
export const WEBMCP_CHROME_FLAGS = ["--enable-features=WebMCPTesting"];

export interface OpenPageOptions {
  headless?: boolean;
  timeoutMs?: number;
  chromeFlags?: string[];
}

export interface ChromeSession extends PageEvaluator {
  close(): Promise<void>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Launch Chrome with WebMCP enabled, open `url`, and wait for the page to
 * settle so module scripts have had a chance to register tools.
 */
export async function openPage(
  url: string,
  options: OpenPageOptions = {},
): Promise<ChromeSession> {
  const { headless = false, timeoutMs = 10000, chromeFlags = [] } = options;
  const chrome = await launch({
    startingUrl: url,
    chromeFlags: [
      ...WEBMCP_CHROME_FLAGS,
      ...(headless ? ["--headless=new"] : []),
      ...chromeFlags,
    ],
  });
  const client = await CDP({ port: chrome.port });
  await client.Runtime.enable();

  async function evaluate(expression: string): Promise<unknown> {
    const { result, exceptionDetails } = await client.Runtime.evaluate({
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error(
        exceptionDetails.exception?.description ?? exceptionDetails.text,
      );
    }
    return result.value;
  }

  // Wait for document.readyState === "complete", bounded by timeoutMs, then
  // give module scripts a beat to finish their registerTool calls.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await evaluate("document.readyState").catch(() => null);
    if (state === "complete") break;
    await sleep(100);
  }
  await sleep(Math.min(500, timeoutMs));

  return {
    evaluate,
    async close() {
      await client.close().catch(() => {});
      await chrome.kill();
    },
  };
}
