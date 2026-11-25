import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { limited } from "@/lib/ratelimit";

// Interim page-view recorder. The Go service in step 7 can take over the same PageView table.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|headless/i.test(ua)) return new Response(null, { status: 204 });
  if (await limited(`track:${ip}`, 200, 60 * 60 * 1000)) return new Response(null, { status: 204 });

  const body = await req.json().catch(() => null) as { path?: string; referrer?: string } | null;
  const path = typeof body?.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : "/";
  let referrer: string | null = null;
  try {
    if (body?.referrer) {
      const h = new URL(body.referrer).hostname;
      if (h && h !== new URL(req.url).hostname) referrer = h.slice(0, 80);
    }
  } catch {}

  const day = new Date().toISOString().slice(0, 10);
  const salt = createHash("sha256").update(`${process.env.AUTH_SECRET}:${day}`).digest("hex");
  const visitor = createHash("sha256").update(`${salt}:${ip}:${ua}`).digest("hex").slice(0, 32);
  const device = /ipad|tablet/i.test(ua) ? "Tablet" : /mobi|android|iphone/i.test(ua) ? "Mobile" : "Desktop";
  const country = req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country");

  await db.pageView.create({ data: { path, visitor, referrer, device, country: country && country !== "XX" ? country : null } });
  return new Response(null, { status: 204 });
}
