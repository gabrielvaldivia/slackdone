import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { DevDials } from "@/components/DevDials";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slackdone",
  description: "Kanban board for Slack Lists",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
        <DevDials />
      </body>
    </html>
  );
}
