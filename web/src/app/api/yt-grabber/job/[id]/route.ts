import { JOB_ID, MGMT_HOST, type ResultBody, UpstreamError, extractKey, fetchResults, flashdata, guard, json, provider, signedDownloadUrl, storageConfig } from "@/lib/ytgrabber";
import { getJob } from "@/lib/ytlocal";

type Job = { status?: string; error?: unknown; result?: ResultBody };

// Polled by the browser. When the job is finished it returns the link to fetch the file from.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard("job", 6000);
  if (g instanceof Response) return g;

  const { id } = await params;
  if (!JOB_ID.test(id)) return json({ error: "Bad job id." }, 400);

  if (provider() === "local") {
    const j = getJob(id, g.userId);
    if (!j) return json({ error: "Download not found (the server may have restarted). Try again." }, 404);
    if (j.state === "failed") return json({ status: "failed", error: j.error ?? "Download failed." });
    if (j.state !== "done") return json({ status: "running" });
    return json({ status: "done", url: `/api/yt-grabber/file/${j.id}`, size: j.size ?? null });
  }

  const st = storageConfig();
  if (!st) return json({ error: "Storage is not configured on the server." }, 503);

  try {
    const s = await flashdata<{ job?: Job } & Job>(`${MGMT_HOST}/v2/jobs/${id}`);
    const job: Job = s.job ?? s;
    if (job.status === "failed") {
      const e = job.error;
      return json({ status: "failed", error: (typeof e === "string" ? e : (e as { message?: string } | undefined)?.message ?? "Download failed").slice(0, 300) });
    }
    if (job.status !== "completed") return json({ status: "running" });

    const result = job.result ?? (await fetchResults(id));
    const r = result.results?.[0] ?? result;
    const fileUrl = r.file_url;
    if (typeof fileUrl !== "string") return json({ status: "failed", error: "Finished, but no file was reported." });

    const key = extractKey(fileUrl, st.bucket);
    // Only ever sign files inside our own folder of the bucket.
    if (!key.startsWith(st.prefix + "/") || key.includes("..")) return json({ status: "failed", error: "Unexpected file location." });

    const name = new URL(req.url).searchParams.get("name")?.slice(0, 150) || key.split("/").pop() || "download";
    const ext = key.includes(".") ? key.slice(key.lastIndexOf(".")) : "";
    const filename = name.toLowerCase().endsWith(ext.toLowerCase()) ? name : name + ext;
    return json({ status: "done", url: signedDownloadUrl(st, key, filename), size: typeof r.file_size === "number" ? r.file_size : null });
  } catch (e) {
    if (e instanceof UpstreamError) return json({ error: e.message }, e.status >= 500 || e.status < 400 ? 502 : e.status);
    return json({ error: "Could not read the job." }, 500);
  }
}
