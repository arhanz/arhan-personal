import { db } from "@/lib/db";
import { ago } from "@/lib/format";
import { ActionForm, Submit } from "@/components/ActionForm";
import { replyTicket } from "@/app/actions";

export default async function Thread({ ticketId, admin }: { ticketId: string; admin: boolean }) {
  const t = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { user: true, messages: { orderBy: { createdAt: "asc" }, include: { author: true } } },
  });
  if (!t) return null;
  return (
    <>
      <h2>{t.subject}</h2>
      <p><span className="badge">{t.status}</span> <span className="muted">{admin ? t.user.name || t.user.email : ""}</span></p>
      {t.messages.map((m) => {
        const fromAdmin = m.author.role === "ADMIN";
        return (
          <div className={"card" + (fromAdmin ? " adm" : "")} key={m.id}>
            <div className="muted" style={{ fontSize: ".84rem" }}>{fromAdmin ? "Support" : m.author.name || m.author.email} · {ago(m.createdAt)}</div>
            <div className="msg">{m.body}</div>
          </div>
        );
      })}
      {t.status === "CLOSED" && !admin ? (
        <p className="muted">This ticket is closed. Open a new one if you need more help.</p>
      ) : (
        <ActionForm action={replyTicket} className="card" resetOnOk>
          <input type="hidden" name="ticketId" value={t.id} />
          <textarea name="body" required maxLength={4000} placeholder="Write a reply" />
          {admin && <label className="ck"><input type="checkbox" name="close" />Close ticket after replying</label>}
          <Submit>Send</Submit>
        </ActionForm>
      )}
    </>
  );
}
