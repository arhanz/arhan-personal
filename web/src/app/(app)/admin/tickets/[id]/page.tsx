import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import PageHead from "@/components/PageHead";
import Thread from "@/components/Thread";

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const t = await db.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!t) notFound();
  return (
    <>
      <PageHead title="Tickets" />
      <p><Link className="l" href="/admin/tickets">← All tickets</Link></p>
      <Thread ticketId={t.id} admin />
    </>
  );
}
