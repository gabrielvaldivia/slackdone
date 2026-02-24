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
            <p>Create a Slack app and add these environment variables:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to{" "}
                <span className="font-mono text-xs">api.slack.com/apps</span>{" "}
                and create a new app
              </li>
              <li>
                Add OAuth scopes:{" "}
                <span className="font-mono text-xs">
                  lists:read, lists:write, search:read, team:read
                </span>
              </li>
              <li>
                Set redirect URL to{" "}
                <span className="font-mono text-xs">
                  http://localhost:3000/api/auth/callback
                </span>
              </li>
              <li>
                Copy Client ID and Secret to{" "}
                <span className="font-mono text-xs">.env.local</span>
              </li>
            </ol>
            <pre className="mt-3 rounded border border-border bg-gray-50 p-3 text-xs text-left">
              {`SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000`}
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
