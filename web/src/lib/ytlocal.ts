import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

/*
 * Self-hosted YouTube search + download using yt-dlp and ffmpeg installed on THIS server.
 * Jobs live in memory, so run Next.js as a single process (pm2 fork mode, not cluster).
 */

/* ---------------------------------------------------------------- config */

const num = (v: string | undefined, d: number, min = 1) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : d;
};

const cfg = () => ({
  bin: process.env.YT_DLP_PATH?.trim() || "yt-dlp",
  ffmpeg: process.env.YT_FFMPEG_PATH?.trim() || "",
  cookies: process.env.YT_COOKIES?.trim() || "",
  proxy: process.env.YT_PROXY?.trim() || "",
  jsRuntime: process.env.YT_JS_RUNTIME?.trim() || "",
  maxConcurrent: num(process.env.YT_MAX_CONCURRENT, 2),   // downloads running at the same time, server-wide
  maxSearch: num(process.env.YT_MAX_SEARCH, 3),           // searches running at the same time, server-wide
  maxMinutes: num(process.env.YT_MAX_MINUTES, 20),        // longest video allowed
  maxMb: num(process.env.YT_MAX_MB, 200),                 // biggest source file allowed
  keepMinutes: num(process.env.YT_KEEP_MINUTES, 20),      // how long a finished file stays on disk
  storeMb: num(process.env.YT_MAX_STORE_MB, 2000),        // total finished files kept on disk
  userJobs: num(process.env.YT_MAX_USER_JOBS, 5),         // queued + running per user
  base: process.env.YT_TMP_DIR?.trim() || path.join(os.tmpdir(), "ytg"),
});

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export class LocalError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/* ---------------------------------------------------------------- state */

class Semaphore {
  private waiters: (() => void)[] = [];
  private active = 0;
  constructor(private max: () => number) {}
  async acquire() {
    if (this.active < this.max()) { this.active++; return; }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }
  release() {
    const next = this.waiters.shift();
    if (next) next(); // hand the slot straight to the next waiter
    else this.active--;
  }
}

export type LocalJob = {
  id: string; userId: string; videoId: string; format: "mp3" | "mp4"; name: string;
  state: "queued" | "running" | "done" | "failed";
  error?: string; dir: string; file?: string; size?: number; created: number; finished?: number;
};

type Store = { jobs: Map<string, LocalJob>; dl: Semaphore; se: Semaphore; probe?: { at: number; v: Status } };
// globalThis so every route handler (and hot reloads) share the same jobs.
const g = globalThis as unknown as { __ytg?: Store };

function store(): Store {
  if (!g.__ytg) {
    g.__ytg = { jobs: new Map(), dl: new Semaphore(() => cfg().maxConcurrent), se: new Semaphore(() => cfg().maxSearch) };
    removeStaleDirs();
    const t = setInterval(() => sweep(), 5 * 60_000);
    if (typeof t === "object" && "unref" in t) t.unref();
  }
  return g.__ytg;
}

function rmDir(dir: string) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function removeStaleDirs() {
  const base = cfg().base;
  try {
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d);
      if (Date.now() - fs.statSync(p).mtimeMs > 3600_000) rmDir(p);
    }
  } catch {}
}

/** Deletes finished jobs (and their files) older than the keep time. */
export function sweep(now = Date.now()) {
  const s = store();
  const keep = cfg().keepMinutes * 60_000;
  for (const [id, j] of s.jobs) {
    if (j.finished && now - j.finished > keep) { rmDir(j.dir); s.jobs.delete(id); }
  }
}

/* --------------------------------------------------------------- running */

// yt-dlp gets a bare environment so it can never see the site's secrets (DB url, AUTH_SECRET ...).
function childEnv(): Record<string, string> {
  const e: Record<string, string> = {};
  for (const k of ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "XDG_CACHE_HOME", "DENO_DIR"]) {
    const v = process.env[k];
    if (v) e[k] = v;
  }
  return e;
}

type Run = { code: number | null; out: string; err: string; timedOut: boolean; missing: boolean };

function run(cmd: string, args: string[], timeoutMs: number, maxOut = 4_000_000): Promise<Run> {
  return new Promise((resolve) => {
    let out = "", err = "", timedOut = false, missing = false, settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (code: number | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ code, out, err, timedOut, missing });
    };
    const p = spawn(cmd, args, { env: childEnv(), stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
    timer = setTimeout(() => {
      timedOut = true;
      try { if (p.pid) process.kill(-p.pid, "SIGKILL"); else p.kill("SIGKILL"); } catch { try { p.kill("SIGKILL"); } catch {} }
    }, timeoutMs);
    p.stdout?.on("data", (d: Buffer) => { if (out.length < maxOut) out += d.toString("utf8"); });
    p.stderr?.on("data", (d: Buffer) => { err = (err + d.toString("utf8")).slice(-8000); });
    p.on("error", (e: Error & { code?: string }) => { missing = e.code === "ENOENT"; err += e.message; done(null); });
    p.on("close", (code: number | null) => done(code));
  });
}

function baseArgs(): string[] {
  const c = cfg();
  const a = ["--no-warnings", "--socket-timeout", "20", "--retries", "3"];
  if (c.cookies) a.push("--cookies", c.cookies);
  if (c.proxy) a.push("--proxy", c.proxy);
  if (c.jsRuntime) a.push("--js-runtimes", c.jsRuntime);
  if (c.ffmpeg) a.push("--ffmpeg-location", c.ffmpeg);
  return a;
}

/** Turns yt-dlp's stderr into something safe to show a visitor; the raw text goes to the server log. */
function friendly(raw: string, ctx: string): string {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const last = [...lines].reverse().find((l) => /^ERROR:/i.test(l)) ?? lines[lines.length - 1] ?? "";
  console.error(`[yt-grabber] ${ctx}: ${last || "(no error text)"}`);
  if (/sign in to confirm|not a bot|http error 429|too many requests|po.?token/i.test(last)) return "YouTube is blocking the server right now. Try again later.";
  if (/js runtime|javascript runtime|deno/i.test(last)) return "The server is missing a component for YouTube. Tell the site owner.";
  const clean = last.replace(/^ERROR:\s*/i, "").replace(/^\[[^\]]+\]\s*[\w-]{11}:\s*/, "").slice(0, 160);
  return clean || "Download failed.";
}

/* ---------------------------------------------------------------- status */

export type Status = { ytdlp: string | null; ffmpeg: boolean };

export async function localStatus(): Promise<Status> {
  const s = store();
  if (s.probe && Date.now() - s.probe.at < 60_000) return s.probe.v;
  const c = cfg();
  const ff = c.ffmpeg ? (fs.existsSync(c.ffmpeg) && fs.statSync(c.ffmpeg).isDirectory() ? path.join(c.ffmpeg, "ffmpeg") : c.ffmpeg) : "ffmpeg";
  const [y, f] = await Promise.all([run(c.bin, ["--version"], 10_000), run(ff, ["-version"], 10_000)]);
  const v: Status = { ytdlp: y.code === 0 ? y.out.trim().split("\n")[0] || "ok" : null, ffmpeg: f.code === 0 };
  if (v.ytdlp && v.ffmpeg) s.probe = { at: Date.now(), v }; // only remember good results
  return v;
}

/* ---------------------------------------------------------------- search */

export type SearchItem = {
  videoId: string; title: string; channel: string;
  duration: number | null; durationString: string | null; viewCount: number | null;
};

/** Uses yt-dlp's built-in YouTube search, so there is no HTML scraping to break. */
export async function localSearch(query: string, n: number): Promise<SearchItem[]> {
  const s = store();
  const q = query.replace(/[\u0000-\u001f]/g, " ").trim();
  if (!q) return [];
  await s.se.acquire();
  try {
    const r = await run(cfg().bin, [...baseArgs(), "--flat-playlist", "--dump-json", `ytsearch${Math.min(20, n + 3)}:${q}`], 40_000);
    if (r.missing) throw new LocalError("yt-dlp is not installed on the server.", 503);
    const items: SearchItem[] = [];
    for (const line of r.out.split("\n")) {
      if (!line.startsWith("{")) continue;
      let v: Record<string, unknown>;
      try { v = JSON.parse(line); } catch { continue; }
      const id = v.id;
      if (typeof id !== "string" || !VIDEO_ID.test(id)) continue;
      if (v.live_status === "is_live" || v.live_status === "is_upcoming") continue;
      items.push({
        videoId: id,
        title: String(v.title ?? "").slice(0, 300),
        channel: String(v.channel ?? v.uploader ?? "").slice(0, 120),
        duration: typeof v.duration === "number" ? v.duration : null,
        durationString: typeof v.duration_string === "string" ? v.duration_string : null,
        viewCount: typeof v.view_count === "number" ? v.view_count : null,
      });
    }
    if (!items.length && (r.code !== 0 || r.timedOut)) {
      throw new LocalError(r.timedOut ? "Search timed out. Try again." : friendly(r.err, `search "${q.slice(0, 60)}"`), 502);
    }
    return items.slice(0, n);
  } finally {
    s.se.release();
  }
}

/* -------------------------------------------------------------- download */

export const safeFileName = (s: string) =>
  s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || "video";

export function startJob(i: { userId: string; videoId: string; format: "mp3" | "mp4"; quality: string; name: string }): string {
  if (!VIDEO_ID.test(i.videoId)) throw new LocalError("Invalid video.", 400);
  const c = cfg();
  const s = store();
  let mine = 0, stored = 0;
  for (const j of s.jobs.values()) {
    if (j.userId === i.userId && (j.state === "queued" || j.state === "running")) mine++;
    if (j.state === "done") stored += j.size ?? 0;
  }
  if (mine >= c.userJobs) throw new LocalError("Too many downloads in progress. Wait for some to finish.", 429);
  if (stored > c.storeMb * 1048576) throw new LocalError("The server is busy. Try again in a few minutes.", 503);

  const id = randomUUID();
  const job: LocalJob = {
    id, userId: i.userId, videoId: i.videoId, format: i.format, name: safeFileName(i.name),
    state: "queued", dir: path.join(c.base, id), created: Date.now(),
  };
  s.jobs.set(id, job);
  void work(job, i.quality);
  return id;
}

async function work(job: LocalJob, quality: string) {
  const c = cfg();
  const s = store();
  await s.dl.acquire();
  const fail = (m: string) => { job.state = "failed"; job.error = m; };
  try {
    job.state = "running";
    fs.mkdirSync(job.dir, { recursive: true, mode: 0o700 });
    const args = [
      ...baseArgs(), "--no-playlist", "--no-progress",
      "--max-filesize", `${c.maxMb}M`,
      "--match-filter", `duration<=${c.maxMinutes * 60} & !is_live`,
      "-o", path.join(job.dir, "%(id)s.%(ext)s"),
    ];
    if (job.format === "mp3") args.push("-x", "--audio-format", "mp3", "--audio-quality", `${quality}K`);
    else args.push("-f", `bv*[height<=${quality}]+ba/b[height<=${quality}]`, "-S", "ext", "--merge-output-format", "mp4");
    args.push(`https://www.youtube.com/watch?v=${job.videoId}`);

    const r = await run(c.bin, args, 10 * 60_000);
    if (r.missing) return fail("yt-dlp is not installed on the server.");
    if (r.timedOut) return fail("Timed out. Try again.");
    const file = fs.existsSync(job.dir) ? fs.readdirSync(job.dir).find((f) => f.endsWith("." + job.format)) : undefined;
    if (r.code !== 0 && !file) return fail(friendly(r.err, `download ${job.videoId}`));
    if (!file) {
      return fail(`Skipped: longer than ${c.maxMinutes} minutes, bigger than ${c.maxMb} MB, or a live stream.`);
    }
    job.file = path.join(job.dir, file);
    job.size = fs.statSync(job.file).size;
    job.state = "done";
  } catch (e) {
    console.error("[yt-grabber] job crashed:", e);
    fail("Download failed.");
  } finally {
    job.finished = Date.now();
    if (job.state === "failed") rmDir(job.dir);
    s.dl.release();
  }
}

/** Only the user who started a job can see it. */
export function getJob(id: string, userId: string): LocalJob | null {
  const j = store().jobs.get(id);
  return j && j.userId === userId ? j : null;
}

export function fileStream(job: LocalJob): ReadableStream {
  return Readable.toWeb(fs.createReadStream(job.file!)) as unknown as ReadableStream;
}

export const fileExists = (job: LocalJob) => !!job.file && fs.existsSync(job.file);
