"use client";

import { useEffect, useRef, useState } from "react";

type Video = {
  videoId: string; title: string; channel: string;
  duration: number | null; durationString: string | null; viewCount: number | null;
};
type Group = { q: string; ids: string[] };
type Fmt = "mp3" | "mp4";
type Job = { id: string; title: string; state: "queued" | "working" | "ready" | "failed"; text: string; url?: string; f: Fmt; q: string };

const MP3_Q = ["128", "192", "256", "320"];
const MP4_Q = ["360", "480", "720", "1080"];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const safeName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || "video";
const fmtViews = (n: number | null) => (n == null ? "" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M views" : n >= 1e3 ? Math.round(n / 1e3) + "K views" : n + " views");
const fmtDur = (v: Video) =>
  v.durationString || (v.duration ? `${Math.floor(v.duration / 60)}:${String(Math.round(v.duration % 60)).padStart(2, "0")}` : "");

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || `Error ${r.status}`);
  return j as T;
}

export default function Grabber({ who, searchReady, downloadReady, note }: { who: string; searchReady: boolean; downloadReady: boolean; note: string }) {
  const [text, setText] = useState("");
  const [perQuery, setPerQuery] = useState(1);
  const [autoSelect, setAutoSelect] = useState(true);
  const [videos, setVideos] = useState<Record<string, Video>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fmt, setFmt] = useState<Fmt>("mp3");
  const [quality, setQuality] = useState("192");
  const [autosave, setAutosave] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const videosRef = useRef(videos);
  videosRef.current = videos;
  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;
  const alive = useRef(true);
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    alive.current = true;
    try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
    return () => { alive.current = false; };
  }, []);

  const toggleTheme = () => {
    const d = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = d;
    try { localStorage.setItem("theme", d); } catch {}
  };

  const changeFmt = (f: Fmt) => { setFmt(f); setQuality(f === "mp3" ? "192" : "720"); };

  /* ------------------------------------------------------------- search */
  async function search() {
    const queries = text.split(/[\n;|]+/).map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (!queries.length || searching) return;
    setErr(""); setSearching(true);
    const out: Video[][] = queries.map(() => []);
    const errors: string[] = [];
    let i = 0;
    const worker = async () => {
      while (i < queries.length) {
        const k = i++;
        try { out[k] = (await post<{ results: Video[] }>("/api/yt-grabber/search", { query: queries[k], perQuery })).results; }
        catch (e) { errors.push(`"${queries[k]}": ${msg(e)}`); }
      }
    };
    try {
      await Promise.all([worker(), worker(), worker()]);
      const all = out.flat();
      setVideos((prev) => { const n = { ...prev }; all.forEach((v) => { n[v.videoId] = v; }); return n; });
      setGroups(queries.map((q, k) => ({ q, ids: out[k].map((v) => v.videoId) })));
      if (autoSelect) setSelected((prev) => { const n = new Set(prev); all.forEach((v) => n.add(v.videoId)); return n; });
      if (errors.length) setErr(errors.slice(0, 5).join("  |  ") + (errors.length > 5 ? `  (+${errors.length - 5} more)` : ""));
    } finally {
      setSearching(false);
    }
  }

  const shown = groups.flatMap((g) => g.ids);
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /* ----------------------------------------------------------- download */
  const upsert = (id: string, patch: Partial<Job>) =>
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === id);
      if (idx < 0) return [{ id, title: id, state: "queued", text: "", f: "mp3", q: "192", ...patch }, ...prev];
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });

  // One browser download at a time, with a short gap, so the browser doesn't block them.
  const saveFile = (url: string) => {
    saveChain.current = saveChain.current.then(async () => {
      const a = document.createElement("a");
      a.href = url; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      await sleep(1200);
    });
  };

  async function runOne(id: string, f: Fmt, q: string) {
    const title = videosRef.current[id]?.title || id;
    upsert(id, { title, f, q, state: "working", text: "Starting…", url: undefined });
    try {
      const name = `${safeName(title)}.${f}`;
      const { jobId } = await post<{ jobId: string }>("/api/yt-grabber/download", { videoId: id, format: f, quality: q, name: safeName(title) });
      upsert(id, { text: "Converting…" });
      const deadline = Date.now() + 15 * 60_000;
      let bad = 0;
      while (Date.now() < deadline && alive.current) {
        await sleep(3000);
        let res: Response;
        try { res = await fetch(`/api/yt-grabber/job/${encodeURIComponent(jobId)}?name=${encodeURIComponent(name)}`, { cache: "no-store" }); }
        catch { if (++bad >= 3) throw new Error("Network problem."); continue; }
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { if (res.status >= 500 && ++bad < 3) continue; throw new Error(j.error || `Error ${res.status}`); }
        bad = 0;
        if (j.status === "failed") throw new Error(j.error || "Download failed");
        if (j.status === "done") {
          const mb = j.size ? ` · ${(j.size / 1048576).toFixed(1)} MB` : "";
          upsert(id, { state: "ready", text: "Ready" + mb, url: j.url });
          if (autosaveRef.current) saveFile(j.url);
          return;
        }
      }
      throw new Error(alive.current ? "Timed out. Try again." : "Cancelled");
    } catch (e) {
      upsert(id, { state: "failed", text: msg(e).slice(0, 160) });
    }
  }

  async function downloadAll() {
    const ids = [...selected];
    if (!ids.length || busy) return;
    setBusy(true); setErr("");
    ids.forEach((id) => upsert(id, { title: videosRef.current[id]?.title || id, f: fmt, q: quality, state: "queued", text: "Waiting…" }));
    let i = 0;
    const worker = async () => { while (i < ids.length) await runOne(ids[i++], fmt, quality); };
    try { await Promise.all([worker(), worker(), worker()]); } finally { setBusy(false); }
  }

  /* --------------------------------------------------------------- view */
  return (
    <div className="ytg">
      <header className="ytg-top">
        <a className="ytg-brand" href="/">Arhan<b>.pk</b></a>
        <span className="ytg-who" title={who}>{who}</span>
        <button type="button" className="ytg-ghost" onClick={toggleTheme} aria-label="Toggle theme">◐ Theme</button>
      </header>

      <main className="ytg-main">
        <h1>YT Grabber</h1>
        <p className="ytg-sub">Type song names (one per line), tick the ones you want, pick MP3 or MP4, then download them all.</p>

        {note && <div className={`ytg-note${!searchReady ? " bad" : ""}`}>{note}</div>}

        <form className="ytg-search" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Songs to search"
            placeholder={"are u crazy lyrics\nparty on my mind lyrics"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void search(); } }}
          />
          <button type="submit" disabled={searching || !searchReady}>{searching ? "Searching…" : "Search"}</button>
        </form>
        <div className="ytg-opts">
          <label>Results per search{" "}
            <select value={perQuery} onChange={(e) => setPerQuery(Number(e.target.value))}>
              <option value={1}>1 (top result)</option><option value={2}>2</option><option value={3}>3</option>
              <option value={5}>5</option><option value={10}>10</option>
            </select>
          </label>
          <label><input type="checkbox" checked={autoSelect} onChange={(e) => setAutoSelect(e.target.checked)} /> Auto-select results</label>
          <span>Enter = search · Shift+Enter = new line (or separate with ;)</span>
        </div>
        {err && <div className="ytg-err" role="alert">{err}</div>}

        {shown.length > 0 && (
          <div className="ytg-tools">
            <button type="button" className="ytg-ghost" onClick={() => setSelected((p) => new Set([...p, ...shown]))}>Select all results</button>
            <button type="button" className="ytg-ghost" onClick={() => setSelected(new Set())}>Clear selection</button>
            <span>{shown.length} video{shown.length > 1 ? "s" : ""} from {groups.length} search{groups.length > 1 ? "es" : ""}</span>
          </div>
        )}

        <div className="ytg-results">
          {groups.length === 0 && <div className="ytg-empty">Search for something to get started.</div>}
          {groups.map((g, gi) => (
            <div key={gi} className="ytg-group">
              <div className="ytg-grp">🔎 {g.q}{g.ids.length ? "" : " — no results"}</div>
              <div className="ytg-grid">
                {g.ids.map((id) => {
                  const v = videos[id]; if (!v) return null;
                  const on = selected.has(id);
                  return (
                    <button key={id} type="button" className={`ytg-card${on ? " sel" : ""}`} aria-pressed={on} onClick={() => toggle(id)}>
                      <span className="ytg-thumb" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/mqdefault.jpg)` }}>
                        <span className="ytg-chk">{on ? "✓" : ""}</span>
                        {fmtDur(v) && <span className="ytg-dur">{fmtDur(v)}</span>}
                      </span>
                      <span className="ytg-meta">
                        <span className="ytg-title">{v.title}</span>
                        <span className="ytg-ch">{[v.channel, fmtViews(v.viewCount)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {jobs.length > 0 && (
          <section className="ytg-queue" aria-label="Downloads">
            <h2>Downloads</h2>
            {jobs.map((j) => (
              <div key={j.id} className="ytg-row">
                <span className="ytg-rt" title={j.title}>{j.title}</span>
                <span className={`ytg-st ${j.state}`}>{j.text}</span>
                {j.state === "ready" && j.url && <button type="button" onClick={() => saveFile(j.url!)}>Save</button>}
                {j.state === "failed" && <button type="button" onClick={() => void runOne(j.id, j.f, j.q)}>Retry</button>}
              </div>
            ))}
          </section>
        )}
      </main>

      <div className="ytg-bar">
        <div className="ytg-barin">
          <strong>{selected.size} selected</strong>
          <div className="ytg-seg" role="group" aria-label="Format">
            <button type="button" aria-pressed={fmt === "mp3"} onClick={() => changeFmt("mp3")}>MP3</button>
            <button type="button" aria-pressed={fmt === "mp4"} onClick={() => changeFmt("mp4")}>MP4</button>
          </div>
          <select value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Quality">
            {(fmt === "mp3" ? MP3_Q : MP4_Q).map((q) => <option key={q} value={q}>{fmt === "mp3" ? `${q} kbps` : `up to ${q}p`}</option>)}
          </select>
          <label className="ytg-auto"><input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} /> Save to my device when ready</label>
          <span className="ytg-spacer" />
          <button type="button" className="ytg-go" disabled={!selected.size || busy || !downloadReady} onClick={() => void downloadAll()}
            title={downloadReady ? "" : note || "Downloads are not set up yet"}>
            {busy ? "Downloading…" : "Download all"}
          </button>
        </div>
      </div>
    </div>
  );
}
