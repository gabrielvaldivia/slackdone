export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight mb-8">
          Terms of Service
        </h1>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>Last updated: March 8, 2026</p>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Service
            </h2>
            <p>
              Slackdone is a free tool that provides a Kanban board interface
              for Slack Lists. The service is provided as-is, without warranty
              of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Your account
            </h2>
            <p>
              You sign in using your Slack account. You are responsible for
              maintaining the security of your Slack credentials. Slackdone
              never sees or stores your Slack password.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Acceptable use
            </h2>
            <p>
              You agree to use the service in compliance with applicable laws
              and Slack&apos;s terms of service. Do not attempt to access data
              belonging to other users or interfere with the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Limitation of liability
            </h2>
            <p>
              Slackdone is not liable for any data loss, service interruptions,
              or damages arising from the use of this service. Use it at your
              own risk.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Changes
            </h2>
            <p>
              These terms may be updated from time to time. Continued use of
              the service constitutes acceptance of the updated terms.
            </p>
          </section>
        </div>

        <div className="mt-12">
          <a
            href="/login"
            className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
          >
            &larr; Back
          </a>
        </div>
      </div>
    </div>
  );
}
