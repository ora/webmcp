import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "WebMCP Workbench",
  version: "0.1.0",
  description:
    "Inspect a page's WebMCP tools, run them with schema-driven forms, and lint them for agent-readiness.",
  minimum_chrome_version: "116",
  // Required (even empty) so the icon click can open the side panel.
  action: {},
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  side_panel: { default_path: "index.html" },
  // NOT activeTab: it never grants access from a side-panel click.
  permissions: ["sidePanel", "scripting", "tabs"],
  host_permissions: ["<all_urls>"],
  icons: {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
});
