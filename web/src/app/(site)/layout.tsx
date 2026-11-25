import type { Metadata } from "next";
import "./portfolio.css";

export const metadata: Metadata = {
  title: "Syed Arhan Zeeshan – Full Stack & Mobile Engineer",
  description: "Syed Arhan Zeeshan, Full Stack & Mobile Engineer: Next.js, Go, Flutter, Three.js, PostgreSQL, Prisma and Linux server admin.",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
