import { NextResponse } from "next/server";

const REPO = "gabrielvaldivia/slackdone";

export async function GET() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return NextResponse.json({ version: null });

    const release = await res.json();
    const version = release.tag_name?.replace(/^v/, "") || null;
    const dmg = release.assets?.find(
      (a: { name: string }) => a.name.endsWith(".dmg")
    );

    return NextResponse.json({
      version,
      downloadUrl: dmg?.browser_download_url || `https://github.com/${REPO}/releases/latest`,
    });
  } catch {
    return NextResponse.json({ version: null });
  }
}
