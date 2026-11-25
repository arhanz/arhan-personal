import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const pw = process.env.ADMIN_PASSWORD;
  if (!email || !pw || pw.length < 12) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) in .env");
  await db.user.upsert({ where: { email }, update: { role: "ADMIN" }, create: { email, name: "Admin", role: "ADMIN", passwordHash: await hash(pw) } });

  const base = ["Admin dashboard", "Built with Next.js and Go", "Prisma with PostgreSQL database"];
  const plans = [
    { slug: "starter", name: "Starter", tagline: "One-page website with a dashboard", kind: "FIXED" as const, priceCents: 1000, sort: 1, features: ["One-page website", ...base] },
    { slug: "business", name: "Business", tagline: "A complete five-page website", kind: "FIXED" as const, priceCents: 5000, sort: 2, features: ["5-page website", ...base, "Clean, mobile-friendly design"] },
    { slug: "custom", name: "Custom", tagline: "Choose exactly how many pages you need", kind: "CUSTOM" as const, setupCents: 1900, perPageCents: 500, sort: 3, features: ["Everything in Business", ...base, "Clean, mobile-friendly design", "Add more pages whenever you need"] },
  ];
  for (const p of plans) await db.plan.upsert({ where: { slug: p.slug }, update: {}, create: p });

  const content: Record<string, unknown> = {
    paymentInfo: { BANK: "", JAZZCASH: "", EASYPAISA: "" },
    services: [
      { title: "Websites and web apps", body: "Fast, modern sites and full web apps built with Next.js and React.", tags: ["Next.js", "React", "Go", "PostgreSQL"] },
      { title: "Admin dashboards", body: "A private area where you manage products, orders and content yourself.", tags: ["Dashboard", "Prisma"] },
      { title: "Online stores", body: "Product catalog and a full checkout flow.", tags: ["Checkout", "Catalog"] },
      { title: "Mobile apps", body: "One Flutter codebase for Android and iOS.", tags: ["Flutter"] },
      { title: "3D web experiences", body: "Interactive 3D scenes in the browser with Three.js.", tags: ["Three.js"] },
      { title: "Servers and hosting", body: "Linux server setup, hosting, licensing and API integration.", tags: ["Linux admin", "Hosting"] },
    ],
  };
  for (const [key, value] of Object.entries(content))
    await db.siteContent.upsert({ where: { key }, update: {}, create: { key, value: value as object } });
  console.log("Seed done. Remove ADMIN_PASSWORD from .env now.");
}
main().finally(() => db.$disconnect());