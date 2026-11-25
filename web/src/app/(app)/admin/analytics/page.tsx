import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { num } from "@/lib/format";
import { DAY, dayKey, dayLabel, lastDays, parseRange, refName, tally } from "@/lib/stats";
import { Donut, HBars, Kpi, LineChart } from "@/lib/charts";
import PageHead from "@/components/PageHead";
import { AutoSelect } from "@/components/ActionForm";

export default async function Analytics({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  await requireAdmin();
  const R = parseRange((await searchParams).r);
  const since = new Date(Date.now() - R * DAY);
  const [views, signups, orders, paid] = await Promise.all([
    db.pageView.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, visitor: true, path: true, referrer: true, device: true, country: true }, take: 200000 }),
    db.user.count({ where: { createdAt: { gte: since }, role: "CLIENT" } }),
    db.order.count({ where: { createdAt: { gte: since } } }),
    db.payment.count({ where: { status: "CONFIRMED", confirmedAt: { gte: since } } }),
  ]);
  const days = lastDays(R);
  const visitors = new Set(views.map((v) => v.visitor)).size;
  const pv = new Map<string, number>(), vs = new Map<string, Set<string>>();
  views.forEach((v) => { const k = dayKey(v.createdAt); pv.set(k, (pv.get(k) ?? 0) + 1); (vs.get(k) ?? vs.set(k, new Set()).get(k)!).add(v.visitor); });
  const pvD = days.map((k) => pv.get(k) ?? 0), vD = days.map((k) => vs.get(k)?.size ?? 0);

  const pages = tally(views, (v) => v.path).slice(0, 8).map((p) => ({ ...p, uniq: new Set(views.filter((v) => v.path === p.l).map((v) => v.visitor)).size }));
  const stages = [["Visitors", visitors], ["Created an account", signups], ["Placed an order", orders], ["Paid", paid]] as const;

  return (
    <>
      <PageHead title="Analytics">
        <form method="get"><AutoSelect className="in" name="r" defaultValue={R} aria-label="Date range">
          {[7, 30, 90].map((n) => <option key={n} value={n}>Last {n} days</option>)}
        </AutoSelect></form>
      </PageHead>
      <div className="grid">
        <Kpi label="Visitors" value={num(visitors)} />
        <Kpi label="Page views" value={num(views.length)} />
        <Kpi label="Pages per visit" value={visitors ? (views.length / visitors).toFixed(1) : "0"} />
      </div>
      <div className="card">
        <h2>Visitors and page views</h2>
        <LineChart labels={days.map(dayLabel)} series={[{ d: pvD, c: "#4cc9ff", area: true }, { d: vD, c: "#0b7fb8" }]} fmt={num} />
        <div className="row muted" style={{ fontSize: ".82rem" }}><span style={{ color: "#0b7fb8" }}>● Visitors</span><span style={{ color: "#38b6e6" }}>● Page views</span></div>
      </div>
      <div className="g2">
        <div className="card"><h2>Traffic sources</h2><HBars rows={tally(views, (v) => refName(v.referrer)).slice(0, 6)} /></div>
        <div className="card"><h2>Devices</h2><Donut parts={tally(views, (v) => v.device ?? "Unknown")} center="" /></div>
      </div>
      <div className="g2">
        <div className="card"><h2>Top pages</h2><div className="tw"><table>
          <thead><tr><th>Page</th><th>Views</th><th>Visitors</th></tr></thead>
          <tbody>{pages.map((p) => <tr key={p.l}><td>{p.l}</td><td>{num(p.v)}</td><td>{num(p.uniq)}</td></tr>)}{!pages.length && <tr><td className="muted">No visits recorded yet.</td></tr>}</tbody>
        </table></div></div>
        <div className="card"><h2>Countries</h2><HBars rows={tally(views.filter((v) => v.country), (v) => v.country!).slice(0, 6)} /></div>
      </div>
      <div className="card">
        <h2>Conversion funnel</h2>
        {stages.map(([l, v], i) => (
          <div className="hb" key={l} style={{ gridTemplateColumns: "150px 1fr 110px" }}>
            <span>{l}</span>
            <span className="t"><i style={{ width: `${stages[0][1] ? Math.min(100, (v / stages[0][1]) * 100) : 0}%`, background: ["#0b7fb8", "#4cc9ff", "#6366f1", "#14b8a6"][i] }} /></span>
            <b>{num(v)}{stages[0][1] ? ` · ${((v / stages[0][1]) * 100).toFixed(1)}%` : ""}</b>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: ".84rem" }}>Visitors are counted from a daily salted hash, never from the raw IP, so a returning visitor counts once per day.</p>
    </>
  );
}
