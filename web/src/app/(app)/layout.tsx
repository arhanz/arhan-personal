import type { Metadata } from "next";
import "./dashboard.css";
import { requireUser } from "@/lib/session";
import Shell from "./Shell";

export const metadata: Metadata = { title: "Dashboard – Arhan.pk", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Shell role={u.role} who={u.name || u.email || ""}>{children}</Shell>
      </body>
    </html>
  );
}
