"use client";

import { useEffect } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    __TAURI_APP__?: boolean;
    __TAURI_APP_VERSION__?: string;
  }
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.split(".").map(Number);
  const l = latest.split(".").map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export function UpdateChecker() {
  useEffect(() => {
    if (!window.__TAURI_APP__) return;

    const currentVersion = window.__TAURI_APP_VERSION__;
    if (!currentVersion) return;

    const DISMISSED_KEY = "updateDismissedVersion";

    async function checkForUpdate() {
      try {
        const res = await fetch("/api/desktop-version");
        const data = await res.json();
        if (!data.version) return;

        if (!compareVersions(currentVersion!, data.version)) return;

        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed === data.version) return;

        toast(`Update available (v${data.version})`, {
          duration: Infinity,
          action: {
            label: "Download",
            onClick: () => window.open(data.downloadUrl, "_blank"),
          },
          onDismiss: () => localStorage.setItem(DISMISSED_KEY, data.version),
        });
      } catch {
        // Silently fail
      }
    }

    // Check after a short delay so it doesn't interfere with initial load
    const timeout = setTimeout(checkForUpdate, 5000);
    return () => clearTimeout(timeout);
  }, []);

  return null;
}
