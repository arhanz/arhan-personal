import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { ago } from "@/lib/format";
import PageHead from "@/components/PageHead";
import { ActionForm, Submit } from "@/components/ActionForm";
import { newTicket } from "@/app/actions";

export default async function Support() {
  const u = await requireClient();
  const tickets = await db.ticket.findMany({ where: { userId: u.id }, orderBy: { updatedAt: "desc" } });
  return (
    <>
      <PageHead title="Support" />
      <ActionForm action={newTicket} className="card">
        <label>Subject<input name="subject" required minLength={3} maxLength={120} /></label>
        <label>How can I help?<textarea name="body" required maxLength={4000} /></label>
        <Submit>Open ticket</Submit>
      </ActionForm>
      {tickets.map((t) => (
        <Link className="card lnk" href={`/dashboard/support/${t.id}`} key={t.id}>
          <div className="row"><strong>{t.subject}</strong><span className="badge">{t.status}</span></div>
          <div className="muted">{ago(t.updatedAt)}</div>
        </Link>
      ))}
    </>
  );
}
