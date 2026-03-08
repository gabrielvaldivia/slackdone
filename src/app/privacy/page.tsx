export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight mb-8">
          Privacy Policy
        </h1>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>Last updated: March 8, 2026</p>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              What we collect
            </h2>
            <p>
              When you sign in with Slack, we receive your name, profile photo,
              and workspace information. We access your Slack Lists data to
              display it in the app. We do not store your Slack messages or any
              data beyond what is needed to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              How we use your data
            </h2>
            <p>
              Your data is used solely to provide the Slackdone service. We do
              not sell, share, or use your data for advertising. Your Slack
              Lists data is fetched in real time and is not permanently stored
              on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Cookies
            </h2>
            <p>
              We use a single session cookie to keep you signed in. No
              tracking or analytics cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Data deletion
            </h2>
            <p>
              You can revoke Slackdone&apos;s access at any time from your Slack
              workspace settings. Once revoked, all associated session data is
              deleted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">
              Contact
            </h2>
            <p>
              For questions about this policy, contact{" "}
              <a
                href="https://gabrielvaldivia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Gabriel Valdivia
              </a>
              .
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
