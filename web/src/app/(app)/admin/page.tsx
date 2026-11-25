import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ago, nice, num, usd } from "@/lib/format";
import { DAY, dayKey, dayLabel, delta, lastDays, parseRange } from "@/lib/stats";
import { Donut, HBars, Kpi, LineChart } from "@/lib/charts";
import PageHead from "@/components/PageHead";
import { AutoSelect } from "@/components/ActionForm";

export default async function Overview({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  await requireAdmin();
  const R = parseRange((await searchParams).r);
  const now = Date.now(), cut = new Date(now - R * DAY), since = new Date(now - 2 * R * DAY);

  const [orders, paid, views, pending, openT, review, statusGroups, plans, recentOrders, recentMsgs] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, planId: true } }),
    db.payment.findMany({ where: { status: "CONFIRMED", confirmedAt: { gte: since } }, select: { confirmedAt: true, amountCents: true } }),
    db.pageView.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, visitor: true }, take: 200000 }),
    db.payment.count({ where: { status: "RECEIPT_UPLOADED" } }),
    db.ticket.count({ where: { status: "OPEN" } }),
    db.project.count({ where: { stage: "REVIEW" } }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.plan.findMany({ orderBy: { sort: "asc" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { user: true, plan: true } }),
    db.ticketMessage.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { author: true, ticket: true } }),
  ]);

  const days = lastDays(R);
  const sumBy = <T,>(xs: T[], d: (x: T) => Date, v: (x: T) => number) => {
    const m = new Map<string, number>();
    xs.forEach((x) => m.set(dayKey(d(x)), (m.get(dayKey(d(x))) ?? 0) + v(x)));
    return days.map((k) => m.get(k) ?? 0);
  };
  const rv = sumBy(paid, (p) => p.confirmedAt!, (p) => p.amountCents);
  const od = sumBy(orders, (o) => o.createdAt, () => 1);
  const visDay = new Map<string, Set<string>>();
  views.forEach((v) => { const k = dayKey(v.createdAt); (visDay.get(k) ?? visDay.set(k, new Set()).get(k)!).add(v.visitor); });
  const vd = days.map((k) => visDay.get(k)?.size ?? 0);

  const cur = { rev: 0, paid: 0, ord: 0, vis: new Set<string>() }, prev = { rev: 0, paid: 0, ord: 0, vis: new Set<string>() };
  paid.forEach((p) => { const t = p.confirmedAt! >= cut ? cur : prev; t.rev += p.amountCents; t.paid++; });
  orders.forEach((o) => { (o.createdAt >= cut ? cur : prev).ord++; });
  views.forEach((v) => { (v.createdAt >= cut ? cur : prev).vis.add(v.visitor); });
  const conv = (x: typeof cur) => (x.vis.size ? (x.ord / x.vis.size) * 100 : 0);
  const aov = (x: typeof cur) => (x.paid ? x.rev / x.paid : 0);

  const total = statusGroups.reduce((a, g) => a + g._count._all, 0);
  const pop = plans.map((p) => ({ l: p.name, v: orders.filter((o) => o.planId === p.id && o.createdAt >= cut).length }));
  const feed = [
    ...recentOrders.map((o) => ({ ts: o.createdAt, t: `${o.user.name || o.user.email} ordered ${o.plan.name} (${usd(o.totalCents)})` })),
    ...recentMsgs.map((m) => ({ ts: m.createdAt, t: `${m.author.role === "ADMIN" ? "You replied to" : (m.author.name || m.author.email) + " wrote in"} “${m.ticket.subject}”` })),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime()).slice(0, 7);
  const labels = days.map(dayLabel);

  return (
    <>
      <PageHead title="Overview">
        <form method="get"><AutoSelect className="in" name="r" defaultValue={R} aria-label="Date range">
          {[7, 30, 90].map((n) => <option key={n} value={n}>Last {n} days</option>)}
        </AutoSelect></form>
      </PageHead>
      <div className="grid">
        <Kpi label="Revenue" value={usd(cur.rev)} d={delta(cur.rev, prev.rev)} spark={rv} />
        <Kpi label="Orders" value={cur.ord} d={delta(cur.ord, prev.ord)} spark={od} />
        <Kpi label="Visitors" value={num(cur.vis.size)} d={delta(cur.vis.size, prev.vis.size)} spark={vd} />
        <Kpi label="Conversion" value={conv(cur).toFixed(1) + "%"} d={delta(conv(cur), conv(prev))} />
        <Kpi label="Avg order value" value={usd(aov(cur))} d={delta(aov(cur), aov(prev))} />
        <Kpi label="Open tickets" value={openT} />
      </div>
      <div className="g2">
        <div className="card"><h2>Revenue</h2><LineChart labels={labels} series={[{ d: rv, c: "#0b7fb8", area: true }]} fmt={usd} /></div>
        <div className="card"><h2>Orders per day</h2><LineChart labels={labels} series={[{ d: od, c: "#6366f1", area: true }]} fmt={(v) => v + " orders"} /></div>
      </div>
      <div className="g2">
        <div className="card">
          <h2>Needs attention</h2>
          <ul className="feed">
            <li><span className="dot" /><div><Link className="l" href="/admin/orders?status=PENDING_PAYMENT">{pending} payment{pending === 1 ? "" : "s"} to confirm</Link></div></li>
            <li><span className="dot" /><div><Link className="l" href="/admin/tickets">{openT} open ticket{openT === 1 ? "" : "s"}</Link></div></li>
            <li><span className="dot" /><div><Link className="l" href="/admin/projects">{review} project{review === 1 ? "" : "s"} in review</Link></div></li>
          </ul>
          <h2 style={{ marginTop: 16 }}>Orders by status</h2>
          <Donut parts={statusGroups.map((g) => ({ l: nice(g.status), v: g._count._all }))} center={total} />
        </div>
        <div className="card">
          <h2>Plan popularity (last {R} days)</h2>
          <HBars rows={pop} />
          <h2 style={{ marginTop: 16 }}>Recent activity</h2>
          <ul className="feed">
            {feed.map((f, i) => <li key={i}><span className="dot" /><div>{f.t}<small>{ago(f.ts)}</small></div></li>)}
            {!feed.length && <li className="muted">Nothing yet.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
