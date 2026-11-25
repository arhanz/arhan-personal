import { z } from "zod";
import { DATA_HOST, UpstreamError, VIDEO_ID, flashdata, guard, json, provider, storageConfig } from "@/lib/ytgrabber";
import { LocalError, localStatus, safeFileName, startJob } from "@/lib/ytlocal";

const common = { videoId: z.string().regex(VIDEO_ID), name: z.string().max(200).optional() };
const body = z.discriminatedUnion("format", [
  z.object({ ...common, format: z.literal("mp3"), quality: z.enum(["128", "192", "256", "320"]) }),
  z.object({ ...common, format: z.literal("mp4"), quality: z.enum(["360", "480", "720", "1080"]) }),
]);

// Starts one download job: on this server with yt-dlp (default) or through FlashData (YT_PROVIDER=flashdata).
export async function POST(req: Request) {
  const g = await guard("download", Number(process.env.YT_HOURLY_LIMIT) || 120);
  if (g instanceof Response) return g;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  const { videoId, format, quality, name } = parsed.data;

  if (provider() === "local") {
    const st = await localStatus();
    if (!st.ytdlp || !st.ffmpeg) return json({ error: "Downloads are not set up on the server yet." }, 503);
    try {
      const jobId = startJob({ userId: g.userId, videoId, format, quality, name: safeFileName(name ?? videoId) });
      return json({ jobId });
    } catch (e) {
      if (e instanceof LocalError) return json({ error: e.message }, e.status);
      return json({ error: "Could not start the download." }, 500);
    }
  }

  // ---- FlashData route: the finished file is delivered into YOUR bucket
  const st = storageConfig();
  if (!st) return json({ error: "Downloads are not set up yet: the storage bucket is not configured on the server." }, 503);

  const storage: Record<string, string> = {
    storage_type: st.type, storage_url: st.bucket, access_key: st.accessKey, secret_key: st.secretKey,
    region: st.region, object_prefix: st.prefix,
  };
  if (st.type === "s3_compatible") storage.endpoint_url = st.endpoint;

  const params = format === "mp3"
    ? { download_type: "audio", output_format: "mp3", audio_quality: quality, storage }
    : { download_type: "audio_video", output_format: "mp4", video_quality: `<=${quality}`, storage };

  try {
    const r = await flashdata<{ id?: string; queries?: { id?: string }[] }>(`${DATA_HOST}/v1/queries`, {
      method: "POST",
      body: { source: "youtube_download", video_id: videoId, params },
    });
    const id = r.queries?.[0]?.id ?? r.id;
    if (!id) return json({ error: "FlashData did not return a job id." }, 502);
    return json({ jobId: id });
  } catch (e) {
    if (e instanceof UpstreamError) return json({ error: e.message }, e.status >= 500 || e.status < 400 ? 502 : e.status);
    return json({ error: "Could not start the download." }, 500);
  }
}
