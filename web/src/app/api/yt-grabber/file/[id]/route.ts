import { contentDisposition, guard, json } from "@/lib/ytgrabber";
import { fileExists, fileStream, getJob } from "@/lib/ytlocal";

// Streams a finished file from this server to the person who started the job (and nobody else).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard("file", 2000);
  if (g instanceof Response) return g;

  const { id } = await params;
  const j = /^[0-9a-f-]{36}$/.test(id) ? getJob(id, g.userId) : null;
  if (!j || j.state !== "done" || !fileExists(j)) return json({ error: "File not found. It may have expired; download it again." }, 404);

  return new Response(fileStream(j), {
    headers: {
      "Content-Type": j.format === "mp3" ? "audio/mpeg" : "video/mp4",
      "Content-Length": String(j.size ?? ""),
      "Content-Disposition": contentDisposition(`${j.name}.${j.format}`),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
