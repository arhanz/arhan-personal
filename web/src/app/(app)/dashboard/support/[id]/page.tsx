import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import PageHead from "@/components/PageHead";
import Thread from "@/components/Thread";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireClient();
  const { id } = await params;
  const t = await db.ticket.findFirst({ where: { id, userId: u.id }, select: { id: true } });
  if (!t) notFound();
  return (
    <>
      <PageHead title="Support" />
      <p><Link className="l" href="/dashboard/support">← All tickets</Link></p>
      <Thread ticketId={t.id} admin={false} />
    </>
  );
}
