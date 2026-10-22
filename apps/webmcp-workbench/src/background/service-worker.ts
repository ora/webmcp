// The whole background: clicking the toolbar icon opens the side panel.
// Everything else (scanning, running, linting) happens in the panel itself
// via chrome.scripting.executeScript — no content scripts, no messaging.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => console.error("setPanelBehavior failed", err));
