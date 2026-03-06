"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DesktopAuthRedirect() {
  const params = useSearchParams();
  const token = params.get("token");
  const action = params.get("action"); // "session" or "complete"

  useEffect(() => {
    if (action === "session" && token) {
      window.location.href = `slackdone://auth/session?token=${encodeURIComponent(token)}`;
    } else {
      window.location.href = "slackdone://auth/complete";
    }
  }, [token, action]);

  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">Redirecting to the Slackdone app...</p>
        <p className="text-xs text-muted-foreground">
          If nothing happens,{" "}
          <a href="/" className="text-blue-600 hover:underline">
            continue in your browser
          </a>
        </p>
      </div>
    </div>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense>
      <DesktopAuthRedirect />
    </Suspense>
  );
}
