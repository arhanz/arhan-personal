import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { dateGB, usd } from "@/lib/format";
import PageHead from "@/components/PageHead";

export default async function Invoices() {
  const u = await requireClient();
  const inv = await db.invoice.findMany({ where: { order: { userId: u.id } }, orderBy: { issuedAt: "desc" }, include: { order: { include: { plan: true } } } });
  return (
    <>
      <PageHead title="Invoices" />
      <div className="card tw">
        <table>
          <thead><tr><th>Invoice</th><th>Plan</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {inv.map((i) => (
              <tr key={i.id}>
                <td><Link className="l" href={`/dashboard/invoices/${i.orderId}`}><strong>{i.number}</strong></Link></td>
                <td>{i.order.plan.name}</td><td>{dateGB(i.issuedAt)}</td><td>{usd(i.order.totalCents)}</td>
                <td><span className="badge ok">Paid</span></td>
              </tr>
            ))}
            {!inv.length && <tr><td className="muted">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
