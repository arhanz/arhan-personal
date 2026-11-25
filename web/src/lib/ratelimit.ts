import { db } from "@/lib/db";

/** Returns true when the caller is over the limit. */
export async function limited(key: string, max: number, windowMs: number) {
  const row = await db.rateLimit.findUnique({ where: { key } });
  const resetAt = new Date(Date.now() + windowMs);
  if (!row || row.resetAt < new Date()) {
    await db.rateLimit.upsert({
      where: { key },
      update: { count: 1, resetAt },
      create: { key, count: 1, resetAt },
    });
    return false;
  }
  if (row.count >= max) return true;
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return false;
}
