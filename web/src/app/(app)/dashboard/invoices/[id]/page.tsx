import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { dateGB, METHODS, usd } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { invoice: true, plan: true, user: true, payment: true } });
  if (!o?.invoice || (o.userId !== u.id && u.role !== "ADMIN")) notFound();
  return (
    <div className="invoice">
      <div className="head"><h1>Invoice {o.invoice.number}</h1><div className="ctl"><PrintButton /></div></div>
      <div className="card">
        <div className="row"><strong>Arhan.pk</strong><span className="sp muted">Issued {dateGB(o.invoice.issuedAt)}</span></div>
        <p className="muted">Syed Arhan Zeeshan, Punjab, Pakistan</p>
        <p><strong>Billed to</strong><br />{o.user.name}<br />{o.user.email}</p>
        <table>
          <thead><tr><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>{o.plan.name} plan{o.pages ? ` (${o.pages} pages)` : ""}</td><td>{usd(o.totalCents)}</td></tr>
            <tr><td><strong>Total (USD)</strong></td><td><strong>{usd(o.totalCents)}</strong></td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 14 }}><span className="badge ok">Paid</span> <span className="muted">via {o.payment ? METHODS[o.payment.method] : ""}</span></p>
      </div>
    </div>
  );
}
