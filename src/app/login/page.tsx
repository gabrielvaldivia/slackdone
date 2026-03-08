"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-[7px]" />
          <h1 className="text-xl font-semibold tracking-tight">Slackdone</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Sign in to manage your Slack Lists.
        </p>
        {error && (
          <p className="text-sm text-red-600">
            {decodeURIComponent(error)}
          </p>
        )}
        <a
          href="/api/auth/login"
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:opacity-90"
        >
          Sign in with Slack
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
