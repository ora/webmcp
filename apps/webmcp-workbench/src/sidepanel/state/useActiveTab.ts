import { useEffect, useState } from "react";

export interface ActiveTab {
  tabId: number;
  url: string;
  title: string;
}

async function resolveActiveTab(): Promise<ActiveTab | null> {
  // activeTab never applies from a side panel; we hold "tabs" and query the
  // panel's own window explicitly.
  const win = await chrome.windows.getCurrent();
  if (win.id === undefined) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (tab?.id === undefined) return null;
  return { tabId: tab.id, url: tab.url ?? "", title: tab.title ?? "" };
}

/**
 * Tracks the tab the panel is pointed at. `pageVersion` bumps whenever the
 * active tab changes or finishes a load, so scans can re-run automatically.
 */
export function useActiveTab(): { tab: ActiveTab | null; pageVersion: number } {
  const [tab, setTab] = useState<ActiveTab | null>(null);
  const [pageVersion, setPageVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void resolveActiveTab().then((next) => {
        if (cancelled) return;
        setTab(next);
        setPageVersion((v) => v + 1);
      });
    };
    refresh();
    const onActivated = () => refresh();
    const onUpdated = (_tabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (info.status === "complete") refresh();
    };
    const onFocusChanged = (windowId: number) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) refresh();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.windows.onFocusChanged.addListener(onFocusChanged);
    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.windows.onFocusChanged.removeListener(onFocusChanged);
    };
  }, []);

  return { tab, pageVersion };
}
