import type { VerifiedTool } from "../lib/pageClient";

export function ToolDetail({
  tool,
  onRun,
}: {
  tool: VerifiedTool;
  onRun: () => void;
}) {
  return (
    <section className="tool-detail">
      <div className="detail-head">
        <h2>{tool.name}</h2>
        <button className="primary" onClick={onRun}>
          Run…
        </button>
      </div>
      <p className="detail-desc">
        {tool.description || <em>No description.</em>}
      </p>
      <h3>Annotations</h3>
      {tool.annotations ? (
        <pre className="code">{JSON.stringify(tool.annotations, null, 2)}</pre>
      ) : (
        <p className="empty">None.</p>
      )}
      <h3>Input schema</h3>
      {tool.inputSchema ? (
        <pre className="code">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
      ) : (
        <p className="empty">None declared.</p>
      )}
    </section>
  );
}
