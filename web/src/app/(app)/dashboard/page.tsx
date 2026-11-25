import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { ago, METHODS, usd } from "@/lib/format";
import { Kpi } from "@/lib/charts";
import PageHead from "@/components/PageHead";
import { ActionForm, Submit } from "@/components/ActionForm";
import { submitProof } from "@/app/actions";

export default async function MyProjects() {
  const u = await requireClient();
  const [orders, openTickets, payInfo] = await Promise.all([
    db.order.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, include: { plan: true, payment: true, project: true, invoice: true } }),
    db.ticket.count({ where: { userId: u.id, status: { not: "CLOSED" } } }),
    db.siteContent.findUnique({ where: { key: "paymentInfo" } }),
  ]);
  const info = (payInfo?.value ?? {}) as Record<string, string>;
  const spent = orders.filter((o) => o.payment?.status === "CONFIRMED").reduce((a, o) => a + o.totalCents, 0);
  const active = orders.filter((o) => o.project && o.project.stage !== "LIVE").length;
  const events: { ts: Date; t: string }[] = [];
  orders.forEach((o) => {
    events.push({ ts: o.createdAt, t: `You ordered ${o.plan.name}` });
    if (o.invoice) events.push({ ts: o.payment?.confirmedAt ?? o.invoice.issuedAt, t: `Payment confirmed, ${o.invoice.number} issued` });
  });
  events.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return (
    <>
      <PageHead title="My projects" />
      <div className="grid">
        <Kpi label="Total spent" value={usd(spent)} />
        <Kpi label="Orders" value={orders.length} />
        <Kpi label="Active projects" value={active} />
        <Kpi label="Open tickets" value={openTickets} />
      </div>

      {orders.length === 0 && <div className="card">You have no orders yet. <Link className="l" href="/dashboard/order">Order a plan</Link></div>}

      {orders.map((o) => {
        const py = o.payment, pr = o.project;
        const canPay = py && ["AWAITING", "REJECTED"].includes(py.status) && py.method !== "CRYPTO_PLISIO";
        return (
          <div className="card" key={o.id}>
            <div className="row">
              <strong>{o.plan.name}{o.pages ? ` (${o.pages} pages)` : ""}</strong>
              <span className="badge">{o.status}</span>
              <strong className="sp">{usd(o.totalCents)}</strong>
            </div>
            {o.invoice && <div className="muted">Invoice {o.invoice.number}</div>}
            {py && (
              <div style={{ marginTop: 10 }}>
                <span className="badge">{METHODS[py.method]}</span>{" "}
                <span className={"badge " + (py.status === "CONFIRMED" ? "ok" : py.status === "REJECTED" ? "bad" : "")}>{py.status}</span>

                {canPay && (
                  <>
                    <p className="msg">{info[py.method] || "Payment details will appear here soon. Open a support ticket if you need them now."}</p>
                    {py.status === "REJECTED" && (
                      <p style={{ color: "var(--err)" }}>Your last payment could not be confirmed{py.rejectReason ? `: ${py.rejectReason}` : ""}. Send your proof again.</p>
                    )}
                    <ActionForm action={submitProof} className="" resetOnOk>
                      <input type="hidden" name="orderId" value={o.id} />
                      <p style={{ margin: "12px 0 8px" }}><strong>Send your payment proof</strong> <span className="muted">(pay {usd(o.totalCents)}, then fill this in)</span></p>
                      <label>Account holder name<input name="acct" required minLength={3} maxLength={80} placeholder="Name on the account you paid from" autoComplete="name" /></label>
                      <label>Transaction ID<input name="ref" required minLength={3} maxLength={60} placeholder="From your payment receipt" /></label>
                      <label>Payment screenshot<input name="shot" type="file" accept="image/png,image/jpeg,image/webp" required /></label>
                      <Submit>Submit payment proof</Submit>
                    </ActionForm>
                  </>
                )}

                {py.status === "RECEIPT_UPLOADED" && (
                  <div className="row" style={{ marginTop: 10 }}>
                    {py.receiptFileId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="thumb" src={`/api/files/${py.receiptFileId}`} alt="Your payment screenshot" />
                    )}
                    <p className="muted" style={{ margin: 0 }}>Proof received from {py.accountName}, transaction {py.reference}. I will confirm it soon.</p>
                  </div>
                )}
                {py.method === "CRYPTO_PLISIO" && py.status === "AWAITING" && (
                  <p className="muted">Crypto checkout is being set up. Open a support ticket and I will send you the payment link.</p>
                )}
              </div>
            )}
            {pr && (
              <div style={{ marginTop: 14 }}>
                <div className="row"><strong>{pr.title}</strong><span className="badge">{pr.stage}</span><span className="muted sp">{pr.progress}%</span></div>
                <div className="bar"><i style={{ width: `${pr.progress}%` }} /></div>
                {pr.liveUrl && <p><a className="l" href={pr.liveUrl} target="_blank" rel="noopener noreferrer">{pr.liveUrl}</a></p>}
              </div>
            )}
          </div>
        );
      })}

      <div className="card">
        <h2>Activity</h2>
        <ul className="feed">
          {events.slice(0, 6).map((f, i) => <li key={i}><span className="dot" /><div>{f.t}<small>{ago(f.ts)}</small></div></li>)}
          {!events.length && <li className="muted">Nothing yet.</li>}
        </ul>
      </div>
    </>
  );
}
