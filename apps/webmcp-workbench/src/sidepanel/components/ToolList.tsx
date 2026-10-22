import type { VerifiedTool } from "../lib/pageClient";

export function ToolList({
  tools,
  selected,
  onSelect,
}: {
  tools: VerifiedTool[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  if (tools.length === 0) {
    return <p className="empty">No tools registered on this page.</p>;
  }
  return (
    <ul className="tool-list">
      {tools.map((tool) => (
        <li key={tool.name}>
          <button
            className={tool.name === selected ? "tool-row selected" : "tool-row"}
            onClick={() => onSelect(tool.name)}
          >
            <span className="tool-name">
              {tool.name}
              {tool.annotations?.readOnlyHint === true && (
                <span className="badge badge-ro" title="readOnlyHint: true">
                  read-only
                </span>
              )}
            </span>
            {tool.description && (
              <span className="tool-desc">{tool.description}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
