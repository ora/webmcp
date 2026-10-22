import type { ActiveTab } from "../state/useActiveTab";
import type { ScanState } from "../state/usePageTools";

export function StatusBar({
  tab,
  state,
  onRescan,
}: {
  tab: ActiveTab | null;
  state: ScanState;
  onRescan: () => void;
}) {
  let dot = "gray";
  let label = "No tab";
  if (tab) {
    switch (state.status) {
      case "idle":
        break;
      case "scanning":
        dot = "amber";
        label = "Scanning…";
        break;
      case "ready":
        dot = "green";
        label = `WebMCP: ${state.tools.length} tool${state.tools.length === 1 ? "" : "s"}`;
        break;
      case "error":
        dot = "red";
        label = state.noModelContext ? "WebMCP: not detected" : "Scan failed";
        break;
    }
  }

  return (
    <header className="statusbar">
      <div className="statusbar-row">
        <span className={`dot dot-${dot}`} aria-hidden="true" />
        <span className="status-label">{label}</span>
        <button className="rescan" onClick={onRescan} disabled={!tab}>
          Re-scan
        </button>
      </div>
      <div className="status-url" title={tab?.url}>
        {tab ? tab.url || tab.title : "Open a page to inspect its WebMCP tools."}
      </div>
      {state.status === "error" && (
        <p className={state.noModelContext ? "help" : "error-text"}>
          {state.message}
        </p>
      )}
    </header>
  );
}
