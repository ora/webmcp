import { useEffect, useState } from "react";
import { runTool, type ExecuteResult, type VerifiedTool } from "../lib/pageClient";
import {
  JsonArea,
  SchemaForm,
  seedFromSchema,
  type JsonSchema,
} from "./SchemaForm";
import { ResultView } from "./ResultView";

export function RunForm({
  tabId,
  tools,
  selected,
  onSelect,
}: {
  tabId: number | null;
  tools: VerifiedTool[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const tool = tools.find((t) => t.name === selected) ?? null;
  const schema = (tool?.inputSchema as JsonSchema | null) ?? null;

  const [input, setInput] = useState<Record<string, unknown>>({});
  const [rawMode, setRawMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form when the target tool changes.
  useEffect(() => {
    setInput(seedFromSchema((tool?.inputSchema as JsonSchema | null) ?? null));
    setResult(null);
    setError(null);
  }, [tool?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tools.length === 0) {
    return <p className="empty">No tools to run — scan a WebMCP page first.</p>;
  }

  const execute = async () => {
    if (!tool || tabId === null) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      setResult(await runTool(tabId, tool.name, input));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="run-form">
      <label className="field">
        <span className="field-label">Tool</span>
        <select value={selected ?? ""} onChange={(e) => onSelect(e.target.value)}>
          {tools.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {tool?.description && <p className="field-help">{tool.description}</p>}

      <div className="form-mode">
        <span className="field-label">Input</span>
        <button className="link-btn" onClick={() => setRawMode((m) => !m)}>
          {rawMode ? "Form view" : "Raw JSON"}
        </button>
      </div>
      {rawMode ? (
        <JsonArea
          value={input}
          onChange={(v) => {
            if (typeof v === "object" && v !== null && !Array.isArray(v)) {
              setInput(v as Record<string, unknown>);
            }
          }}
        />
      ) : (
        <SchemaForm schema={schema} value={input} onChange={setInput} />
      )}

      <button
        className="primary execute"
        onClick={() => void execute()}
        disabled={running || !tool || tabId === null}
      >
        {running ? "Running…" : "Execute"}
      </button>

      <ResultView result={result} error={error} running={running} />
    </section>
  );
}
