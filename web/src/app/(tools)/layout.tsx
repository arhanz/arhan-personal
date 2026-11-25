import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YT Grabber – Arhan.pk",
  description: "Search songs, pick several, and download them as MP3 or MP4 in one go.",
  robots: { index: false, follow: false },
};

// Own root layout so tools like this stay separate from the portfolio and the client dashboard.
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
