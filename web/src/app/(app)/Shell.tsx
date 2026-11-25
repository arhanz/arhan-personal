"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "next-auth/react";

const TABS = {
  ADMIN: [
    ["/admin", "Overview", "▦"], ["/admin/analytics", "Analytics", "◔"], ["/admin/orders", "Orders", "☰"],
    ["/admin/clients", "Clients", "☺"], ["/admin/projects", "Projects", "◧"], ["/admin/invoices", "Invoices", "▤"],
    ["/admin/tickets", "Tickets", "✉"], ["/admin/content", "Content", "✎"],
  ],
  CLIENT: [
    ["/dashboard", "My projects", "▦"], ["/dashboard/order", "Order a plan", "＋"],
    ["/dashboard/invoices", "Invoices", "▤"], ["/dashboard/support", "Support", "✉"],
  ],
} as const;

export default function Shell({
  role, who, children,
}: { role: "ADMIN" | "CLIENT"; who: string; children: React.ReactNode }) {
  const path = usePathname();
  useEffect(() => {
    try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  }, []);
  useEffect(() => {
    document.querySelector(".side .tabs a.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [path]);
  const toggle = () => {
    const d = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = d;
    try { localStorage.setItem("theme", d); } catch {}
  };
  const logOut = async () => {
    try { await signOut({ redirect: false }); } catch {}
    window.location.assign("/login");
  };
  const root = role === "ADMIN" ? "/admin" : "/dashboard";
  return (
    <div className="app">
      <nav className="side" aria-label="Sections">
        <div className="brand">Arhan<b>.pk</b></div>
        <div className="tabs">
          {TABS[role].map(([href, name, ic]) => {
            const on = href === root ? path === href : path.startsWith(href);
            return <Link key={href} href={href} className={on ? "on" : ""}><span className="ic">{ic}</span>{name}</Link>;
          })}
        </div>
        <div className="foot">
          <div className="who" title={who}>{who}</div>
          <a href="/">View site</a>
          <button type="button" onClick={toggle} aria-label="Toggle theme">◐ Theme</button>
          <button type="button" onClick={logOut}>Log out</button>
        </div>
      </nav>
      <div className="main">{children}</div>
    </div>
  );
}
