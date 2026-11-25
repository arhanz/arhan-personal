import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ago } from "@/lib/format";
import { Kpi } from "@/lib/charts";
import PageHead from "@/components/PageHead";

export default async function AdminTickets() {
  await requireAdmin();
  const tickets = await db.ticket.findMany({ orderBy: { updatedAt: "desc" }, take: 100, include: { user: true } });
  const n = (s: string) => tickets.filter((t) => t.status === s).length;
  return (
    <>
      <PageHead title="Tickets" />
      <div className="grid"><Kpi label="Open" value={n("OPEN")} /><Kpi label="Answered" value={n("ANSWERED")} /><Kpi label="Closed" value={n("CLOSED")} /></div>
      {tickets.map((t) => (
        <Link className="card lnk" href={`/admin/tickets/${t.id}`} key={t.id}>
          <div className="row"><strong>{t.subject}</strong><span className="badge">{t.status}</span></div>
          <div className="muted">{t.user.name || t.user.email} · {ago(t.updatedAt)}</div>
        </Link>
      ))}
      {!tickets.length && <p className="muted">No tickets yet.</p>}
    </>
  );
}
