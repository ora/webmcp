import { useEffect, useState } from "react";
import { useActiveTab } from "./state/useActiveTab";
import { usePageTools } from "./state/usePageTools";
import { StatusBar } from "./components/StatusBar";
import { ToolList } from "./components/ToolList";
import { ToolDetail } from "./components/ToolDetail";
import { RunForm } from "./components/RunForm";
import { AuditPanel } from "./components/AuditPanel";

type View = "inspect" | "run" | "audit";
const VIEWS: { id: View; label: string }[] = [
  { id: "inspect", label: "Inspect" },
  { id: "run", label: "Run" },
  { id: "audit", label: "Audit" },
];

export function App() {
  const { tab, pageVersion } = useActiveTab();
  const { state, rescan } = usePageTools(tab?.tabId ?? null, pageVersion);
  const [view, setView] = useState<View>("inspect");
  const [selected, setSelected] = useState<string | null>(null);

  const tools = state.status === "ready" ? state.tools : [];
  const selectedTool = tools.find((t) => t.name === selected) ?? null;

  // Keep a valid selection as scans come and go.
  useEffect(() => {
    if (tools.length > 0 && !tools.some((t) => t.name === selected)) {
      setSelected(tools[0].name);
    }
  }, [tools, selected]);

  return (
    <div className="app">
      <StatusBar tab={tab} state={state} onRescan={rescan} />
      <nav className="tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? "tab active" : "tab"}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <main className="view">
        {view === "inspect" && (
          <div className="inspect">
            <ToolList tools={tools} selected={selected} onSelect={setSelected} />
            {selectedTool && (
              <ToolDetail
                tool={selectedTool}
                onRun={() => setView("run")}
              />
            )}
          </div>
        )}
        {view === "run" && (
          <RunForm
            tabId={tab?.tabId ?? null}
            tools={tools}
            selected={selected}
            onSelect={setSelected}
          />
        )}
        {view === "audit" && (
          <AuditPanel tools={tools} scanned={state.status === "ready"} />
        )}
      </main>
    </div>
  );
}
