import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { dateGB, usd } from "@/lib/format";
import { Kpi } from "@/lib/charts";
import PageHead from "@/components/PageHead";

export default async function AdminInvoices() {
  await requireAdmin();
  const inv = await db.invoice.findMany({ orderBy: { issuedAt: "desc" }, take: 100, include: { order: { include: { user: true, plan: true } } } });
  return (
    <>
      <PageHead title="Invoices" />
      <div className="grid">
        <Kpi label="Invoices" value={inv.length} />
        <Kpi label="Total invoiced" value={usd(inv.reduce((a, i) => a + i.order.totalCents, 0))} />
      </div>
      <div className="card tw">
        <table>
          <thead><tr><th>Invoice</th><th>Client</th><th>Plan</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {inv.map((i) => (
              <tr key={i.id}>
                <td><Link className="l" href={`/dashboard/invoices/${i.orderId}`}><strong>{i.number}</strong></Link></td>
                <td>{i.order.user.name || i.order.user.email}</td><td>{i.order.plan.name}</td>
                <td>{dateGB(i.issuedAt)}</td><td>{usd(i.order.totalCents)}</td><td><span className="badge ok">Paid</span></td>
              </tr>
            ))}
            {!inv.length && <tr><td className="muted">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
