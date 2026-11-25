import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { dateGB, METHODS, usd } from "@/lib/format";
import PageHead from "@/components/PageHead";
import { AutoSelect } from "@/components/ActionForm";
import { updateOrderStatus } from "@/app/actions";

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const f = (await searchParams).status;
  const status = Object.values(OrderStatus).find((s) => s === f);
  const orders = await db.order.findMany({
    where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 60,
    include: { user: true, plan: true, payment: true, invoice: true },
  });
  return (
    <>
      <PageHead title="Orders" />
      <form method="get" className="row" style={{ marginBottom: 12 }}>
        <AutoSelect className="in" name="status" defaultValue={status ?? ""} aria-label="Filter orders">
          <option value="">All statuses</option>
          {Object.values(OrderStatus).map((s) => <option key={s}>{s}</option>)}
        </AutoSelect>
      </form>
      {orders.map((o) => {
        const py = o.payment;
        return (
          <div className="card" key={o.id}>
            <div className="row"><strong>{o.plan.name}{o.pages ? ` (${o.pages} pages)` : ""}</strong><span className="badge">{o.status}</span><strong className="sp">{usd(o.totalCents)}</strong></div>
            <div className="muted">{o.user.name || o.user.email} · {dateGB(o.createdAt)}{o.invoice ? ` · ${o.invoice.number}` : ""}</div>
            {py && (
              <p style={{ margin: "8px 0" }}>Payment: <span className="badge">{METHODS[py.method]}</span>{" "}
                <span className={"badge " + (py.status === "CONFIRMED" ? "ok" : py.status === "REJECTED" ? "bad" : "")}>{py.status}</span>
                {py.reference && <> reference <code>{py.reference}</code></>}
              </p>
            )}
            <div className="row">
              {py?.status === "RECEIPT_UPLOADED" && <Link className="b" href={`/admin/orders/${o.id}`} style={{ textDecoration: "none", display: "inline-block" }}>Review payment</Link>}
              {py?.status === "AWAITING" && <span className="muted">Waiting for the client’s payment proof</span>}
              <form action={updateOrderStatus}>
                <input type="hidden" name="orderId" value={o.id} />
                <AutoSelect className="in" name="status" defaultValue={o.status}>
                  {Object.values(OrderStatus).map((s) => <option key={s}>{s}</option>)}
                </AutoSelect>
              </form>
            </div>
          </div>
        );
      })}
      {!orders.length && <p className="muted">No orders.</p>}
    </>
  );
}
