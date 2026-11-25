"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OrderStatus, PaymentMethod, ProjectStage } from "@prisma/client";
import { db } from "@/lib/db";
import { signOut } from "@/auth";
import { requireAdmin, requireUser } from "@/lib/session";
import { saveBuffer, sniffImage } from "@/lib/storage";

type State = { ok?: string; error?: string; n?: number };
const done = (ok: string): State => ({ ok, n: Date.now() });
const fail = (error: string): State => ({ error, n: Date.now() });
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const audit = (actorId: string, action: string, entity: string, entityId?: string, meta?: object) =>
  db.auditLog.create({ data: { actorId, action, entity, entityId, meta } });

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

/* ---------------- client ---------------- */

export async function placeOrder(_: State, f: FormData): Promise<State> {
  const u = await requireUser();
  const plan = await db.plan.findFirst({ where: { slug: str(f, "plan"), active: true } });
  const method = str(f, "method") as PaymentMethod;
  if (!plan) return fail("Choose a plan.");
  if (!Object.values(PaymentMethod).includes(method)) return fail("Choose a payment method.");
  let pages: number | null = null;
  let total = plan.priceCents ?? 0;
  if (plan.kind === "CUSTOM") {
    pages = Math.max(1, Math.min(30, parseInt(str(f, "pages")) || 1));
    total = (plan.setupCents ?? 0) + (plan.perPageCents ?? 0) * pages;
  }
  const order = await db.order.create({
    data: { userId: u.id, planId: plan.id, pages, totalCents: total, payment: { create: { method, amountCents: total } } },
  });
  await audit(u.id, "order.create", "Order", order.id, { plan: plan.slug, total });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function submitProof(_: State, f: FormData): Promise<State> {
  const u = await requireUser();
  const order = await db.order.findFirst({ where: { id: str(f, "orderId"), userId: u.id }, include: { payment: true } });
  const p = order?.payment;
  if (!order || !p) return fail("Order not found.");
  if (!["AWAITING", "REJECTED"].includes(p.status) || p.method === "CRYPTO_PLISIO") return fail("Payment proof can't be sent for this order.");
  const acct = str(f, "acct"), ref = str(f, "ref");
  if (acct.length < 3 || acct.length > 80) return fail("Enter the account holder name (3 to 80 characters).");
  if (ref.length < 3 || ref.length > 60) return fail("Enter the transaction ID (3 to 60 characters).");
  const file = f.get("shot");
  if (!(file instanceof File) || !file.size) return fail("Attach a PNG, JPG or WebP screenshot.");
  if (file.size > 5 * 1024 * 1024) return fail("Screenshot is too large (max 5 MB).");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return fail("That file is not a PNG, JPG or WebP image.");
  const key = await saveBuffer(buf, kind.ext);
  const rec = await db.file.create({
    data: { ownerId: u.id, orderId: order.id, kind: "RECEIPT", storageKey: key, originalName: file.name.slice(0, 120), mime: kind.mime, size: buf.length },
  });
  await db.payment.update({
    where: { id: p.id },
    data: { accountName: acct, reference: ref, receiptFileId: rec.id, status: "RECEIPT_UPLOADED", submittedAt: new Date(), rejectReason: null },
  });
  await audit(u.id, "payment.proof", "Payment", p.id);
  revalidatePath("/dashboard");
  return done("Proof sent. I will confirm it soon.");
}

export async function newTicket(_: State, f: FormData): Promise<State> {
  const u = await requireUser();
  const subject = str(f, "subject"), body = str(f, "body");
  if (subject.length < 3 || subject.length > 120) return fail("Subject needs 3 to 120 characters.");
  if (!body || body.length > 4000) return fail("Write your message (up to 4000 characters).");
  const t = await db.ticket.create({
    data: { userId: u.id, subject, messages: { create: { authorId: u.id, body } } },
  });
  revalidatePath("/dashboard/support");
  redirect(`/dashboard/support/${t.id}`);
}

export async function replyTicket(_: State, f: FormData): Promise<State> {
  const u = await requireUser();
  const body = str(f, "body");
  if (!body || body.length > 4000) return fail("Write your reply (up to 4000 characters).");
  const t = await db.ticket.findUnique({ where: { id: str(f, "ticketId") } });
  if (!t) return fail("Ticket not found.");
  const admin = u.role === "ADMIN";
  if (!admin && (t.userId !== u.id || t.status === "CLOSED")) return fail("You can't reply to this ticket.");
  await db.ticketMessage.create({ data: { ticketId: t.id, authorId: u.id, body } });
  await db.ticket.update({
    where: { id: t.id },
    data: { status: admin ? (f.get("close") === "on" ? "CLOSED" : "ANSWERED") : "OPEN" },
  });
  revalidatePath(`/dashboard/support/${t.id}`);
  revalidatePath(`/admin/tickets/${t.id}`);
  return done("Sent");
}

/* ---------------- admin ---------------- */

export async function reviewPayment(_: State, f: FormData): Promise<State> {
  const admin = await requireAdmin();
  const orderId = str(f, "orderId"), decision = str(f, "decision"), reason = str(f, "reason");
  const order = await db.order.findUnique({ where: { id: orderId }, include: { payment: true, plan: true, project: true, invoice: true } });
  if (!order?.payment || order.payment.status !== "RECEIPT_UPLOADED") return fail("This payment is not waiting for review.");

  if (decision === "reject") {
    if (!reason) return fail("Add a reason so the client knows what to fix.");
    await db.payment.update({ where: { id: order.payment.id }, data: { status: "REJECTED", rejectReason: reason.slice(0, 300) } });
    await audit(admin.id, "payment.reject", "Payment", order.payment.id, { reason });
  } else if (decision === "confirm") {
    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: order.payment!.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), rejectReason: null } });
      if (order.status === "PENDING_PAYMENT") await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
      if (!order.project) await tx.project.create({ data: { orderId: order.id, title: `${order.plan.name} website` } });
      if (!order.invoice) {
        const year = new Date().getFullYear();
        const last = await tx.invoice.findFirst({ where: { number: { startsWith: `INV-${year}-` } }, orderBy: { number: "desc" } });
        const n = last ? parseInt(last.number.slice(-4)) + 1 : 1;
        await tx.invoice.create({ data: { orderId: order.id, number: `INV-${year}-${String(n).padStart(4, "0")}` } });
      }
    });
    await audit(admin.id, "payment.confirm", "Payment", order.payment.id);
  } else return fail("Unknown decision.");

  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  redirect("/admin/orders");
}

export async function updateOrderStatus(f: FormData) {
  const admin = await requireAdmin();
  const status = str(f, "status") as OrderStatus;
  if (!Object.values(OrderStatus).includes(status)) return;
  await db.order.update({ where: { id: str(f, "orderId") }, data: { status } });
  await audit(admin.id, "order.status", "Order", str(f, "orderId"), { status });
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
}

export async function toggleClient(f: FormData) {
  const admin = await requireAdmin();
  const id = str(f, "userId");
  if (id === admin.id) return;
  const u = await db.user.findUnique({ where: { id } });
  if (!u) return;
  await db.user.update({ where: { id }, data: { disabled: !u.disabled } });
  await audit(admin.id, u.disabled ? "client.enable" : "client.disable", "User", id);
  revalidatePath("/admin/clients");
}

export async function saveProject(_: State, f: FormData): Promise<State> {
  const admin = await requireAdmin();
  const stage = str(f, "stage") as ProjectStage;
  const url = str(f, "url");
  if (!Object.values(ProjectStage).includes(stage)) return fail("Choose a stage.");
  if (url && (!/^https:\/\//.test(url) || url.length > 200)) return fail("Use an https:// link.");
  const progress = Math.max(0, Math.min(100, parseInt(str(f, "progress")) || 0));
  await db.project.update({ where: { orderId: str(f, "orderId") }, data: { stage, progress, liveUrl: url || null } });
  await audit(admin.id, "project.save", "Project", str(f, "orderId"), { stage, progress });
  revalidatePath("/admin/projects");
  revalidatePath("/dashboard");
  return done("Project saved");
}

const cents = (v: string) => Math.max(0, Math.round((parseFloat(v) || 0) * 100));

export async function savePlan(_: State, f: FormData): Promise<State> {
  const admin = await requireAdmin();
  const plan = await db.plan.findUnique({ where: { id: str(f, "planId") } });
  if (!plan) return fail("Plan not found.");
  const name = str(f, "name");
  if (!name) return fail("Plan name is required.");
  const features = str(f, "features").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12);
  await db.plan.update({
    where: { id: plan.id },
    data: {
      name,
      tagline: str(f, "tagline"),
      features,
      active: f.get("active") === "on",
      ...(plan.kind === "FIXED"
        ? { priceCents: cents(str(f, "price")) }
        : { setupCents: cents(str(f, "setup")), perPageCents: cents(str(f, "per")) }),
    },
  });
  await audit(admin.id, "plan.save", "Plan", plan.id);
  revalidatePath("/");
  revalidatePath("/dashboard/order");
  return done(`${name} saved. The site and order page use it now.`);
}

const services = z.array(z.object({ title: z.string().min(1).max(80), body: z.string().max(400), tags: z.array(z.string().max(30)).max(8) })).max(12);

export async function saveServices(_: State, f: FormData): Promise<State> {
  const admin = await requireAdmin();
  let raw: unknown;
  try { raw = JSON.parse(str(f, "json")); } catch { return fail("Invalid JSON, nothing saved."); }
  const parsed = services.safeParse(raw);
  if (!parsed.success) return fail("Each service needs a title, body and tags list. Nothing saved.");
  await db.siteContent.upsert({
    where: { key: "services" }, update: { value: parsed.data, updatedById: admin.id }, create: { key: "services", value: parsed.data, updatedById: admin.id },
  });
  revalidatePath("/");
  return done("Services saved");
}

export async function savePaymentInfo(_: State, f: FormData): Promise<State> {
  const admin = await requireAdmin();
  const value = { BANK: str(f, "BANK").slice(0, 500), JAZZCASH: str(f, "JAZZCASH").slice(0, 500), EASYPAISA: str(f, "EASYPAISA").slice(0, 500) };
  await db.siteContent.upsert({
    where: { key: "paymentInfo" }, update: { value, updatedById: admin.id }, create: { key: "paymentInfo", value, updatedById: admin.id },
  });
  revalidatePath("/dashboard");
  return done("Payment details saved");
}
