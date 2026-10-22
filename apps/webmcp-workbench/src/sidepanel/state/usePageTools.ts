import { useCallback, useEffect, useState } from "react";
import { scanTools, type VerifiedTool } from "../lib/pageClient";

export type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "ready"; tools: VerifiedTool[] }
  | { status: "error"; message: string; noModelContext: boolean };

/** Scans the active tab for WebMCP tools; re-scans when the page changes. */
export function usePageTools(
  tabId: number | null,
  pageVersion: number,
): { state: ScanState; rescan: () => void } {
  const [state, setState] = useState<ScanState>({ status: "idle" });

  const rescan = useCallback(() => {
    if (tabId === null) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "scanning" });
    void scanTools(tabId).then(
      (tools) => setState({ status: "ready", tools }),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setState({
          status: "error",
          message,
          // normalizeListResult throws NO_MODELCONTEXT_HELP for this case.
          noModelContext: message.includes("ModelContext"),
        });
      },
    );
  }, [tabId]);

  useEffect(() => {
    rescan();
  }, [rescan, pageVersion]);

  return { state, rescan };
}
