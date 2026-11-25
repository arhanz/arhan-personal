import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { dateGB, usd } from "@/lib/format";
import { Kpi } from "@/lib/charts";
import PageHead from "@/components/PageHead";
import { toggleClient } from "@/app/actions";

export default async function Clients() {
  await requireAdmin();
  const clients = await db.user.findMany({
    where: { role: "CLIENT" }, orderBy: { createdAt: "desc" },
    include: { orders: { include: { payment: true } } },
  });
  const spent = (c: (typeof clients)[number]) => c.orders.filter((o) => o.payment?.status === "CONFIRMED").reduce((a, o) => a + o.totalCents, 0);
  return (
    <>
      <PageHead title="Clients" />
      <div className="grid">
        <Kpi label="Clients" value={clients.length} />
        <Kpi label="Active" value={clients.filter((c) => !c.disabled).length} />
        <Kpi label="Lifetime revenue" value={usd(clients.reduce((a, c) => a + spent(c), 0))} />
      </div>
      <div className="card tw">
        <table>
          <thead><tr><th>Client</th><th>Orders</th><th>Spent</th><th>Joined</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong><div className="muted">{c.email}</div></td>
                <td>{c.orders.length}</td><td>{usd(spent(c))}</td><td>{dateGB(c.createdAt)}</td>
                <td><span className={"badge " + (c.disabled ? "bad" : "ok")}>{c.disabled ? "Disabled" : "Active"}</span></td>
                <td><form action={toggleClient}><input type="hidden" name="userId" value={c.id} /><button className="b g">{c.disabled ? "Enable" : "Disable"}</button></form></td>
              </tr>
            ))}
            {!clients.length && <tr><td className="muted">No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
