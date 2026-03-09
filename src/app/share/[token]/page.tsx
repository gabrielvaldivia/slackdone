import { Metadata } from "next";
import { getShareToken } from "@/lib/store";
import SharedBoardClient from "./SharedBoardClient";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const share = await getShareToken(token);
  const viewName = share?.viewSnapshot?.name || "Shared View";

  return {
    title: `${viewName} — Slackdone`,
    description: `${viewName} on Slackdone`,
    openGraph: {
      title: `${viewName} — Slackdone`,
      description: `${viewName} on Slackdone`,
      type: "website",
    },
  };
}

export default async function SharedBoardPage({ params }: Props) {
  const { token } = await params;
  return <SharedBoardClient token={token} />;
}
