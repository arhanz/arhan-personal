import { z } from "zod";
import { DATA_HOST, UpstreamError, flashdata, guard, json, provider } from "@/lib/ytgrabber";
import { LocalError, localSearch } from "@/lib/ytlocal";

const body = z.object({
  query: z.string().trim().min(1).max(200),
  perQuery: z.number().int().min(1).max(10).default(1),
});

type Item = {
  videoId?: string; title?: string; channel?: string;
  duration?: number | null; durationString?: string | null; viewCount?: number | null;
};

// One search per request. The browser sends several in parallel, so the limit below is per search.
export async function POST(req: Request) {
  const g = await guard("search", 600);
  if (g instanceof Response) return g;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Type something to search for." }, 400);
  const { query, perQuery } = parsed.data;

  try {
    if (provider() === "local") return json({ results: await localSearch(query, perQuery) });

    const r = await flashdata<{ results?: { results?: Item[] }[] }>(`${DATA_HOST}/v1/queries/realtime`, {
      method: "POST",
      body: { source: "youtube_search", query, params: { max_results: Math.min(20, perQuery + 4), filters: { type: "video" } } },
    });
    const items = (r.results?.[0]?.results ?? [])
      .filter((v) => typeof v.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(v.videoId))
      .slice(0, perQuery)
      .map((v) => ({
        videoId: v.videoId!, title: String(v.title ?? "").slice(0, 300), channel: String(v.channel ?? "").slice(0, 120),
        duration: v.duration ?? null, durationString: v.durationString ?? null, viewCount: v.viewCount ?? null,
      }));
    return json({ results: items });
  } catch (e) {
    if (e instanceof LocalError) return json({ error: e.message }, e.status);
    if (e instanceof UpstreamError) return json({ error: e.message }, e.status >= 500 || e.status < 400 ? 502 : e.status);
    return json({ error: "Search failed." }, 500);
  }
}
