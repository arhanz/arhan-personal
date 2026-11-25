import { createHash, createHmac } from "node:crypto";
import { auth } from "@/auth";
import { limited } from "@/lib/ratelimit";
import { localStatus } from "@/lib/ytlocal";

/* ------------------------------------------------------------------ config */

export type Provider = "local" | "flashdata";
/** "local" = yt-dlp on this server (default). "flashdata" = FlashData API + your own bucket. */
export const provider = (): Provider => (process.env.YT_PROVIDER?.trim().toLowerCase() === "flashdata" ? "flashdata" : "local");

export const DATA_HOST = "https://data.flashdata.dev";
export const MGMT_HOST = "https://api.flashdata.dev";

export type Storage = {
  type: "s3" | "s3_compatible";
  bucket: string;
  region: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
  prefix: string;
};

export function apiKeyReady() {
  return !!process.env.FLASHDATA_API_KEY;
}

/** Returns the bucket settings, or null while the bucket is not configured yet. */
export function storageConfig(): Storage | null {
  const type = process.env.YT_STORAGE_TYPE === "s3_compatible" ? "s3_compatible" : "s3";
  const bucket = process.env.YT_BUCKET?.trim();
  const accessKey = process.env.YT_ACCESS_KEY?.trim();
  const secretKey = process.env.YT_SECRET_KEY?.trim();
  const endpoint = (process.env.YT_ENDPOINT ?? "").trim().replace(/\/+$/, "");
  if (!bucket || !accessKey || !secretKey) return null;
  if (type === "s3_compatible" && !/^https:\/\//.test(endpoint)) return null;
  const prefix = (process.env.YT_PREFIX ?? "yt-grabber").trim().replace(/^\/+|\/+$/g, "") || "yt-grabber";
  return { type, bucket, region: process.env.YT_REGION?.trim() || (type === "s3_compatible" ? "auto" : "us-east-1"), endpoint, accessKey, secretKey, prefix };
}

/* ------------------------------------------------------------------ access */

/** Logged-in users only, plus a per-user hourly cap so nobody can burn credits. */
export async function guard(kind: "search" | "download" | "job" | "file", max: number): Promise<{ userId: string } | Response> {
  const s = await auth();
  if (!s?.user?.id) return json({ error: "Please sign in again." }, 401);
  if (await limited(`ytg:${kind}:${s.user.id}`, max, 60 * 60 * 1000)) {
    return json({ error: "Too many requests. Try again later." }, 429);
  }
  return { userId: s.user.id };
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/* --------------------------------------------------------------- flashdata */

export class UpstreamError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function errorText(v: unknown): string {
  if (!v) return "Unknown error";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["message", "detail", "error"]) {
      if (typeof o[k] === "string") return o[k] as string;
      if (o[k] && typeof o[k] === "object") return errorText(o[k]);
    }
  }
  return "Unknown error";
}

export async function flashdata<T = Record<string, unknown>>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = process.env.FLASHDATA_API_KEY;
  if (!key) throw new UpstreamError("FLASHDATA_API_KEY is not set on the server.", 503);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "X-API-Key": key, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new UpstreamError("Could not reach FlashData.", 502);
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) throw new UpstreamError(`${res.status}: ${errorText(data ?? text.slice(0, 200))}`.slice(0, 300), res.status === 401 || res.status === 403 ? 502 : res.status);
  return data as T;
}

/** Completed results come back as a 302 to temporary storage; fetch it WITHOUT the API key. */
export type ResultBody = { results?: ResultBody[]; file_url?: unknown; file_size?: unknown };

export async function fetchResults(jobId: string): Promise<ResultBody> {
  const key = process.env.FLASHDATA_API_KEY!;
  const res = await fetch(`${MGMT_HOST}/v2/jobs/${jobId}/results`, { headers: { "X-API-Key": key }, redirect: "manual", cache: "no-store" });
  let body: Response = res;
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc || !/^https:\/\//.test(loc)) throw new UpstreamError("Bad result redirect.", 502);
    body = await fetch(loc, { cache: "no-store" });
  }
  if (!body.ok) throw new UpstreamError(`Result not available (${body.status}).`, 502);
  return (await body.json()) as ResultBody;
}

/* ----------------------------------------------------------- presigned URL */

const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

export type PresignOptions = {
  host: string;
  path: string; // raw, unencoded, starts with "/"
  accessKey: string;
  secretKey: string;
  region: string;
  expires?: number;
  query?: Record<string, string>;
  amzDate?: string; // tests only
};

/** AWS SigV4 query-string signature for a GET (S3 and S3-compatible stores such as R2). */
export function presignGet(o: PresignOptions): string {
  const amzDate = o.amzDate ?? new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${o.region}/s3/aws4_request`;
  const canonPath = o.path.split("/").map(rfc3986).join("/");
  const q: Record<string, string> = {
    ...(o.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${o.accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(o.expires ?? 900),
    "X-Amz-SignedHeaders": "host",
  };
  const canonQuery = Object.keys(q).sort().map((k) => `${rfc3986(k)}=${rfc3986(q[k])}`).join("&");
  const canonical = ["GET", canonPath, canonQuery, `host:${o.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonical)].join("\n");
  let k = hmac("AWS4" + o.secretKey, date);
  k = hmac(k, o.region);
  k = hmac(k, "s3");
  k = hmac(k, "aws4_request");
  const signature = createHmac("sha256", k).update(toSign).digest("hex");
  return `https://${o.host}${canonPath}?${canonQuery}&X-Amz-Signature=${signature}`;
}

/** Object key from whatever form FlashData reports file_url in (s3://bucket/key or https URL). */
export function extractKey(fileUrl: string, bucket: string): string {
  let p: string;
  if (fileUrl.startsWith("s3://")) p = fileUrl.slice(5);
  else {
    try { p = decodeURIComponent(new URL(fileUrl).pathname); } catch { p = fileUrl; }
  }
  const segs = p.replace(/^\/+/, "").split("/");
  if (segs[0] === bucket) segs.shift();
  return segs.join("/");
}

export function contentDisposition(filename: string): string {
  const clean = filename.replace(/["\\\r\n]/g, "").trim() || "download";
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${rfc3986(clean)}`;
}

export function signedDownloadUrl(st: Storage, key: string, filename: string): string {
  const disposition = contentDisposition(filename);
  const base = { accessKey: st.accessKey, secretKey: st.secretKey, region: st.region, query: { "response-content-disposition": disposition } };
  if (st.type === "s3_compatible") {
    return presignGet({ ...base, host: new URL(st.endpoint).host, path: `/${st.bucket}/${key}` });
  }
  if (st.bucket.includes(".")) return presignGet({ ...base, host: `s3.${st.region}.amazonaws.com`, path: `/${st.bucket}/${key}` });
  return presignGet({ ...base, host: `${st.bucket}.s3.${st.region}.amazonaws.com`, path: `/${key}` });
}

/* -------------------------------------------------------------- validation */

export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const JOB_ID = /^[A-Za-z0-9_-]{6,100}$/;

/** What the page should offer right now, plus a one-line note when something still needs setting up. */
export async function providerStatus(): Promise<{ searchReady: boolean; downloadReady: boolean; note: string }> {
  if (provider() === "flashdata") {
    const search = apiKeyReady();
    const dl = search && storageConfig() !== null;
    return {
      searchReady: search, downloadReady: dl,
      note: !search ? "Search is not set up: the server is missing FLASHDATA_API_KEY."
        : !dl ? "Search and selection work. Downloading is switched off until the storage bucket is added on the server (see YT-GRABBER.md)." : "",
    };
  }
  const st = await localStatus();
  if (!st.ytdlp) return { searchReady: false, downloadReady: false, note: "yt-dlp is not installed on the server yet (see YT-GRABBER.md)." };
  if (!st.ffmpeg) return { searchReady: true, downloadReady: false, note: "Search works. Downloading is switched off until ffmpeg is installed on the server (see YT-GRABBER.md)." };
  return { searchReady: true, downloadReady: true, note: "" };
}
