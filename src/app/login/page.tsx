"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const [showNav, setShowNav] = useState(false);

  useEffect(() => {
    if (!ctaRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowNav(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(ctaRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav — appears after scrolling past CTA */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-border transition-all duration-300 ${
          showNav
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-full pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt=""
              width={24}
              height={24}
              className="rounded-[6px]"
            />
            <span className="text-sm font-semibold tracking-tight">
              Slackdone
            </span>
          </div>
          <a
            href="/api/auth/login"
            className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:opacity-90"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20 max-w-2xl mx-auto">
        <Image
          src="/logo.png"
          alt=""
          width={56}
          height={56}
          className="rounded-[14px] mb-5"
        />
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-3">
          Slackdone
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mb-8">
          A single kanban for all your Slack Lists.
        </p>
        {error && (
          <p className="text-sm text-red-600 mb-4">
            {decodeURIComponent(error)}
          </p>
        )}
        <a
          ref={ctaRef}
          href="/api/auth/login"
          className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:opacity-90"
        >
          Get started with Slack
        </a>
      </section>

      {/* App screenshot — desktop version */}
      <section className="relative max-w-5xl mx-auto px-6 overflow-hidden max-h-[50vh] hidden sm:block">
        <div className="rounded-t-xl border border-b-0 border-border overflow-hidden">
          <Image
            src="/screenshot.png"
            alt="Slackdone app screenshot"
            width={1920}
            height={1200}
            className="block w-full"
            priority
          />
        </div>
      </section>
      {/* App screenshot — mobile version */}
      <section className="relative max-w-[340px] mx-auto px-6 overflow-hidden max-h-[92vw] sm:hidden">
        <div className="rounded-t-[24px] border border-b-0 border-border overflow-hidden aspect-[9/19.5]">
          <Image
            src="/screenshot-mobile.png"
            alt="Slackdone mobile app screenshot"
            width={390}
            height={844}
            className="block w-full h-full object-cover object-top"
            priority
          />
        </div>
      </section>
      <div className="border-t border-border" />

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-20">
          <FeatureCard
            color="#3b82f6"
            title="Multiple workspaces"
            description="Connect all your Slack workspaces and manage your lists from a single view."
          />
          <FeatureCard
            color="#6366f1"
            title="Show only what matters"
            description="Blazing-fast search or filter by assignee, status, or any other property."
          />
          <FeatureCard
            color="#f59e0b"
            title="Saved views"
            description="Save your favorite filter combinations and switch between them instantly."
          />

          <FeatureCard
            color="#8b5cf6"
            title="Mobile optimized"
            description="Slackdone is designed to be used on the go with a mobile-friendly interface."
          />

          <FeatureCard
            color="#ec4899"
            title="Shareable views"
            description="Share a read-only or editable link to any saved view — like Notion or Google Docs."
          />

          <FeatureCard
            color="#14b8a6"
            title="Desktop app"
            description="A native macOS app with its own window, keyboard shortcuts, and notifications."
          />

          <FeatureCard
            color="#f97316"
            title="Live updates"
            description="Shared views auto-refresh so collaborators always see the latest changes."
          />

          <FeatureCard
            color="#06b6d4"
            title="API"
            description="Connect to your favorite LLM or build custom integrations with a REST API."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-6">
          <p className="text-xs text-muted-foreground">
            Built by{" "}
            <a
              href="https://gabrielvaldivia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              Gabriel Valdivia
            </a>
          </p>
          <div className="flex items-center gap-4">
            <a
              href="/privacy"
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  color,
  title,
  description,
}: {
  color: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div
        className="mb-3 h-2 w-8 rounded-full"
        style={{ backgroundColor: color }}
      />
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
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
