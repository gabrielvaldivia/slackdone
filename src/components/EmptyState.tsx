"use client";

interface EmptyStateProps {
  hasEnvVars: boolean;
  hasWorkspaces: boolean;
  onConnect: () => void;
}

export default function EmptyState({
  hasEnvVars,
  hasWorkspaces,
  onConnect,
}: EmptyStateProps) {
  if (!hasEnvVars) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <h2 className="text-lg font-medium">Setup Required</h2>
          <div className="space-y-2 text-sm text-muted text-left">
            <p>
              Add these environment variables (Vercel dashboard or{" "}
              <span className="font-mono text-xs">.env.local</span>):
            </p>
            <pre className="mt-3 rounded border border-border bg-gray-50 p-3 text-xs text-left">
              {`SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (!hasWorkspaces) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-lg font-medium">No workspaces connected</h2>
          <p className="text-sm text-muted">
            Connect a Slack workspace to get started.
          </p>
          <button
            onClick={onConnect}
            className="border border-foreground bg-foreground px-4 py-2 text-sm text-background hover:bg-transparent hover:text-foreground transition-colors"
          >
            Connect Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-medium">Select a list</h2>
        <p className="text-sm text-muted">
          Choose a workspace and list from the header to view your board.
        </p>
      </div>
    </div>
  );
}
