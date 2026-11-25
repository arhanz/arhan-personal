import { auth } from "@/auth";
import { db } from "@/lib/db";
import { readStored } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await auth();
  if (!s?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const file = await db.file.findUnique({ where: { id } });
  if (!file || (file.ownerId !== s.user.id && s.user.role !== "ADMIN")) return new Response("Not found", { status: 404 });
  try {
    const data = await readStored(file.storageKey);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": file.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
