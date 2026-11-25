import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ago, METHODS, usd } from "@/lib/format";
import PageHead from "@/components/PageHead";
import { ReviewPanel } from "@/components/ActionForm";
import { reviewPayment } from "@/app/actions";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { user: true, plan: true, payment: true } });
  if (!o?.payment) notFound();
  const py = o.payment;
  return (
    <>
      <PageHead title="Review payment" />
      <p><Link className="l" href="/admin/orders">← All orders</Link></p>
      {py.status !== "RECEIPT_UPLOADED" && <div className="card">This payment is {py.status.toLowerCase().replace("_", " ")}. Nothing to review.</div>}
      <div className="card">
        <div className="mgrid">
          <div>
            {py.receiptFileId ? (
              <a href={`/api/files/${py.receiptFileId}`} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="shot" src={`/api/files/${py.receiptFileId}`} alt="Payment screenshot from the client" />
              </a>
            ) : <p className="muted">No screenshot.</p>}
            <p className="muted" style={{ fontSize: ".8rem" }}>Click the screenshot to open it full size</p>
          </div>
          <div>
            <table><tbody>
              <tr><td className="muted">Client</td><td><strong>{o.user.name || o.user.email}</strong></td></tr>
              <tr><td className="muted">Plan</td><td>{o.plan.name}{o.pages ? ` (${o.pages} pages)` : ""}</td></tr>
              <tr><td className="muted">Amount to receive</td><td><strong>{usd(o.totalCents)}</strong></td></tr>
              <tr><td className="muted">Method</td><td>{METHODS[py.method]}</td></tr>
              <tr><td className="muted">Account holder name</td><td><strong>{py.accountName}</strong></td></tr>
              <tr><td className="muted">Transaction ID</td><td><strong><code>{py.reference}</code></strong></td></tr>
              <tr><td className="muted">Submitted</td><td>{py.submittedAt ? ago(py.submittedAt) : "-"}</td></tr>
            </tbody></table>
            {py.status === "RECEIPT_UPLOADED" && <ReviewPanel action={reviewPayment} orderId={o.id} amount={usd(o.totalCents)} />}
          </div>
        </div>
      </div>
    </>
  );
}
