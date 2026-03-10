import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { DevDials } from "@/components/DevDials";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slackdone",
  description: "Kanban board for Slack Lists",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/apple-touch-icon.png",
  },
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
        <Toaster position="bottom-center" toastOptions={{ style: { width: "auto", borderRadius: "9999px", padding: "8px 12px" } }} />
        <Analytics />
        <DevDials />
      </body>
    </html>
  );
}
