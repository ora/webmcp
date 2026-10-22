import { lintTools, type VerifiedTool } from "../lib/pageClient";

export function AuditPanel({
  tools,
  scanned,
}: {
  tools: VerifiedTool[];
  scanned: boolean;
}) {
  if (!scanned) return <p className="empty">Scan a page to audit its tools.</p>;
  if (tools.length === 0) return <p className="empty">No tools to audit.</p>;

  const findings = lintTools(tools);
  const byTool = new Map<string, string[]>();
  for (const f of findings) {
    byTool.set(f.tool, [...(byTool.get(f.tool) ?? []), f.message]);
  }

  return (
    <section className="audit">
      {findings.length === 0 ? (
        <p className="audit-clean">
          ✓ {tools.length} tool{tools.length === 1 ? "" : "s"}, no lint findings.
        </p>
      ) : (
        <>
          <p className="audit-summary">
            {findings.length} finding{findings.length === 1 ? "" : "s"} across{" "}
            {byTool.size} tool{byTool.size === 1 ? "" : "s"}:
          </p>
          {[...byTool.entries()].map(([tool, messages]) => (
            <div className="audit-group" key={tool}>
              <h3>{tool}</h3>
              <ul>
                {messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
