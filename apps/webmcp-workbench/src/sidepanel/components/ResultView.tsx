import type { ExecuteResult } from "../lib/pageClient";

export function ResultView({
  result,
  error,
  running,
}: {
  result: ExecuteResult | null;
  error: string | null;
  running: boolean;
}) {
  if (running) return <p className="empty">Running…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!result) return null;
  const parsedDiffers = result.parsed !== result.raw;
  return (
    <section className="result">
      <h3>Result</h3>
      {parsedDiffers && (
        <pre className="code">{JSON.stringify(result.parsed, null, 2)}</pre>
      )}
      <h4>Raw DOMString</h4>
      <pre className="code raw">{result.raw}</pre>
    </section>
  );
}
