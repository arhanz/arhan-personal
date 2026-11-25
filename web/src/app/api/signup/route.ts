import { NextResponse } from "next/server";
import { hash } from "@node-rs/argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { limited } from "@/lib/ratelimit";

const body = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(200),
  password: z.string().min(10).max(200),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (await limited(`signup:${ip}`, 5, 60 * 60 * 1000))
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your details and try again." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } }))
    return NextResponse.json({ error: "That email is already registered." }, { status: 409 });

  await db.user.create({
    data: { email, name: parsed.data.name, passwordHash: await hash(parsed.data.password) },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
