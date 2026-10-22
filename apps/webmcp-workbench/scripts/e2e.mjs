// Full UI E2E: Chrome + WebMCP flags + the built extension. Opens the real
// side panel (user-gesture eval from an extension page), then drives
// Inspect -> Run -> Audit against the bookshop fixture, plus the 0-tools and
// WebMCP-not-detected states.
//
// Needs a Chrome that still honors --load-extension: branded Chrome >= 137
// silently ignores it, so point CHROME_PATH at Chrome for Testing, e.g.
//   npx @puppeteer/browsers install chrome@stable --path ~/.cache/puppeteer
//   CHROME_PATH=~/.cache/puppeteer/chrome/<ver>/chrome-mac-arm64/'Google Chrome for Testing.app'/Contents/MacOS/'Google Chrome for Testing' npm run e2e
// Run `npm run build` first. HEADFUL=1 shows the browser.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIXTURE = join(ROOT, "tests/fixtures/bookshop");
const EXT_DIST = join(ROOT, "apps/webmcp-workbench/dist");
const req = createRequire(join(ROOT, "packages/webmcp-verify/package.json"));
const { launch } = req("chrome-launcher");
const CDP = req("chrome-remote-interface");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((rq, rs) => {
  const p = normalize(new URL(rq.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
  const f = join(FIXTURE, p);
  if (!f.startsWith(FIXTURE) || !existsSync(f)) return rs.writeHead(404).end();
  rs.writeHead(200, { "content-type": MIME[extname(f)] ?? "text/plain" }).end(readFileSync(f));
});
await new Promise((r) => server.listen(8123, r));

const chrome = await launch({
  startingUrl: "http://localhost:8123/index.html",
  ignoreDefaultFlags: true,
  chromeFlags: [
    "--enable-features=WebMCPTesting",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    ...(process.env.HEADFUL === "1" ? [] : ["--headless=new"]),
    `--load-extension=${EXT_DIST}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
  ],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fails.push(name);
};

const attach = async (targetId) => {
  const client = await CDP({ port: chrome.port, target: targetId });
  await client.Runtime.enable();
  return client;
};
const evalIn = async (client, expression, opts = {}) => {
  const { result, exceptionDetails } = await client.Runtime.evaluate({
    expression,
    awaitPromise: true,
    returnByValue: true,
    ...opts,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

try {
  await sleep(2000);
  const version = await CDP.Version({ port: chrome.port });
  const browser = await CDP({ target: version.webSocketDebuggerUrl, local: true });
  const getTargets = async () => (await browser.Target.getTargets()).targetInfos;

  let targets = await getTargets();
  const sw = targets.find((t) => t.url.endsWith("/service-worker-loader.js"));
  check("extension loaded (service worker present)", !!sw, sw?.url);
  if (!sw) throw new Error("extension did not load");
  const extId = new URL(sw.url).host;
  const panelUrl = `chrome-extension://${extId}/index.html`;

  const bookshop = targets.find((t) => t.type === "page" && t.url.includes("localhost:8123"));
  check("bookshop tab open", !!bookshop, bookshop?.url);

  // Open the side panel: a real extension page evaluated with userGesture.
  const { targetId: helperId } = await browser.Target.createTarget({ url: panelUrl });
  await sleep(800);
  const helper = await attach(helperId);
  const opened = await evalIn(
    helper,
    "(async () => { const w = await chrome.windows.getCurrent(); await chrome.sidePanel.open({ windowId: w.id }); return 'opened'; })()",
    { userGesture: true },
  ).catch((e) => `failed: ${e.message}`);
  check("side panel opened", opened === "opened", String(opened).slice(0, 120));
  await helper.close();
  await browser.Target.closeTarget({ targetId: helperId });
  await sleep(500);

  // Closing the helper tab re-activates the bookshop tab; make sure.
  await browser.Target.activateTarget({ targetId: bookshop.targetId });
  await sleep(1000);

  targets = await getTargets();
  const panel = targets.find((t) => t.url === panelUrl && t.targetId !== helperId);
  check("side panel target present", !!panel, panel && `${panel.type} ${panel.url}`);
  if (!panel) throw new Error("no panel target");
  const ui = await attach(panel.targetId);
  await sleep(1500); // auto-scan

  // --- Inspect view ---
  const text1 = await evalIn(ui, "document.body.innerText");
  check("StatusBar reports 1 tool", /WebMCP: 1 tool/.test(text1), text1.slice(0, 120).replace(/\n/g, " | "));
  check("Inspect lists search_books", text1.includes("search_books"));
  check("Inspect shows read-only badge", text1.includes("read-only"));
  check("Inspect shows schema", text1.includes("inputSchema") || text1.includes('"query"'));

  // --- Run view: fill the schema form and execute ---
  await evalIn(ui, `[...document.querySelectorAll('button')].find(b => b.textContent === 'Run').click()`);
  await sleep(300);
  const formOk = await evalIn(ui, `(() => {
    const input = document.querySelector('.schema-form input[type="text"]');
    if (!input) return 'no input';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'the');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'filled';
  })()`);
  check("schema form renders query field", formOk === "filled", String(formOk));
  await sleep(200);
  await evalIn(ui, `[...document.querySelectorAll('button')].find(b => b.textContent === 'Execute').click()`);
  await sleep(1500);
  const text2 = await evalIn(ui, "document.body.innerText");
  check("Run shows parsed matches", text2.includes('"matches"'), text2.slice(0, 200).replace(/\n/g, " | "));
  check("Run shows raw DOMString", text2.includes("Raw DOMString"));

  // --- Audit view ---
  await evalIn(ui, `[...document.querySelectorAll('button')].find(b => b.textContent === 'Audit').click()`);
  await sleep(300);
  const text3 = await evalIn(ui, "document.body.innerText");
  check("Audit reports clean fixture", /no lint findings/.test(text3), text3.slice(0, 160).replace(/\n/g, " | "));

  // --- flag-on, no registrations: navigate bookshop tab to a plain page ---
  const pageClient = await attach(bookshop.targetId);
  await pageClient.Page.enable();
  await pageClient.Page.navigate({ url: "http://localhost:8123/books.json" });
  await sleep(2000);
  const text4 = await evalIn(ui, "document.body.innerText");
  check(
    "StatusBar reports 0 tools on plain page",
    /WebMCP: 0 tools/.test(text4),
    text4.slice(0, 120).replace(/\n/g, " | "),
  );
} finally {
  await chrome.kill();
}

// --- second launch WITHOUT WebMCP flags: not-detected guidance ---
const chrome2 = await launch({
  startingUrl: "http://localhost:8123/index.html",
  ignoreDefaultFlags: true,
  chromeFlags: [
    "--disable-features=DisableLoadExtensionCommandLineSwitch,WebMCPTesting,WebMCP",
    ...(process.env.HEADFUL === "1" ? [] : ["--headless=new"]),
    `--load-extension=${EXT_DIST}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
  ],
});
try {
  await sleep(2000);
  const version = await CDP.Version({ port: chrome2.port });
  const browser = await CDP({ target: version.webSocketDebuggerUrl, local: true });
  const targets = (await browser.Target.getTargets()).targetInfos;
  const sw = targets.find((t) => t.url.endsWith("/service-worker-loader.js"));
  const extId = new URL(sw.url).host;
  const panelUrl = `chrome-extension://${extId}/index.html`;
  const bookshop = targets.find((t) => t.type === "page" && t.url.includes("localhost:8123"));
  const { targetId: helperId } = await browser.Target.createTarget({ url: panelUrl });
  await sleep(800);
  const helper = await CDP({ port: chrome2.port, target: helperId });
  await helper.Runtime.enable();
  await helper.Runtime.evaluate({
    expression:
      "(async () => { const w = await chrome.windows.getCurrent(); await chrome.sidePanel.open({ windowId: w.id }); })()",
    awaitPromise: true,
    userGesture: true,
  });
  await helper.close();
  await browser.Target.closeTarget({ targetId: helperId });
  await browser.Target.activateTarget({ targetId: bookshop.targetId });
  await sleep(2000);
  const panel = (await browser.Target.getTargets()).targetInfos.find(
    (t) => t.url === panelUrl,
  );
  const ui = await CDP({ port: chrome2.port, target: panel.targetId });
  await ui.Runtime.enable();
  await sleep(1500);
  const { result } = await ui.Runtime.evaluate({
    expression: "document.body.innerText",
    returnByValue: true,
  });
  const text = result.value;
  check(
    "StatusBar shows not-detected guidance when WebMCP is off",
    text.includes("WebMCP: not detected") && text.includes("enable-webmcp-testing"),
    text.slice(0, 220).replace(/\n/g, " | "),
  );
} finally {
  await chrome2.kill();
  server.close();
}

console.log(fails.length ? `\n${fails.length} FAILURES` : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
