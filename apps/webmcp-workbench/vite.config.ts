import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  // CRITICAL: the functions from @ora-ai/webmcp-verify/page-fns are injected
  // into pages via chrome.scripting.executeScript, which serializes them by
  // source. Down-leveling async/optional-chaining would emit references to
  // helpers (__awaiter, ...) OUTSIDE the function body, breaking injection.
  // chrome110+ keeps them native.
  build: { target: "esnext" },
  esbuild: { target: "chrome110" },
});
