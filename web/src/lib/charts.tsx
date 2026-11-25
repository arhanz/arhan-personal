import { num, short } from "@/lib/format";

export const PAL = ["#0b7fb8", "#4cc9ff", "#6366f1", "#14b8a6", "#94a3b8", "#f59e0b"];
const nice = (m: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};

export function Spark({ d }: { d: number[] }) {
  const max = Math.max(1, ...d), n = d.length;
  const pts = d.map((v, i) => `${(i * 90) / (n - 1 || 1)},${24 - (v / max) * 22}`).join(" ");
  return (
    <svg viewBox="0 0 90 26" width="90" height="26" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--accent-d)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function Kpi({ label, value, d, spark }: { label: string; value: string | number; d?: number | null; spark?: number[] }) {
  return (
    <div className="card kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {d !== undefined && (
        <div className={"d " + (d === null ? "flat" : d >= 0 ? "up" : "dn")}>
          {d === null ? "no earlier data" : `${d >= 0 ? "▲ " : "▼ "}${Math.abs(d).toFixed(0)}% vs previous period`}
        </div>
      )}
      {spark && <Spark d={spark} />}
    </div>
  );
}

export function LineChart({ labels, series, fmt }: { labels: string[]; series: { d: number[]; c: string; area?: boolean }[]; fmt: (v: number) => string }) {
  const W = 640, H = 210, pl = 42, pr = 10, pt = 10, pb = 24, n = labels.length;
  const max = nice(Math.max(1, ...series.flatMap((s) => s.d)));
  const X = (i: number) => pl + (n > 1 ? (i * (W - pl - pr)) / (n - 1) : 0);
  const Y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  const step = Math.max(1, Math.floor(n / 5));
  return (
    <div className="ch">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chart">
        {[0, 1, 2, 3, 4].map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={Y((max * t) / 4)} y2={Y((max * t) / 4)} stroke="var(--border)" />
            <text x={pl - 6} y={Y((max * t) / 4) + 4} textAnchor="end" className="ax">{short((max * t) / 4)}</text>
          </g>
        ))}
        {labels.map((l, i) => i % step === 0 && <text key={i} x={X(i)} y={H - 6} textAnchor="middle" className="ax">{l}</text>)}
        {series.map((s, si) => {
          const pts = s.d.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
          return (
            <g key={si}>
              {s.area && <polygon points={`${pl},${H - pb} ${pts} ${X(n - 1)},${H - pb}`} fill={s.c} opacity=".16" />}
              <polyline points={pts} fill="none" stroke={s.c} strokeWidth="2.2" strokeLinejoin="round" />
            </g>
          );
        })}
        {labels.map((l, i) => (
          <circle key={i} cx={X(i)} cy={Y(series[0].d[i])} r="6" fill="transparent">
            <title>{`${l}: ${series.map((s) => fmt(s.d[i])).join(" · ")}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export function Donut({ parts, center }: { parts: { l: string; v: number }[]; center: string | number }) {
  const C = 2 * Math.PI * 40, tot = parts.reduce((a, p) => a + p.v, 0);
  let off = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" width="120" height="120">
        {parts.map((p, i) => {
          const len = tot ? (p.v / tot) * C : 0;
          const el = (
            <circle key={i} r="40" cx="60" cy="60" fill="none" stroke={PAL[i % PAL.length]} strokeWidth="18"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)">
              <title>{`${p.l}: ${p.v}`}</title>
            </circle>
          );
          off += len;
          return el;
        })}
        <text x="60" y="65" textAnchor="middle" className="dc">{center}</text>
      </svg>
      <ul className="leg">
        {parts.map((p, i) => (
          <li key={i}><i style={{ background: PAL[i % PAL.length] }} />{p.l}<b>{tot ? Math.round((p.v / tot) * 100) : 0}%</b></li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ rows, fmt }: { rows: { l: string; v: number }[]; fmt?: (v: number) => string }) {
  const m = Math.max(1, ...rows.map((r) => r.v));
  if (!rows.length) return <p className="muted">No data yet.</p>;
  return (
    <>
      {rows.map((r, i) => (
        <div className="hb" key={r.l}>
          <span>{r.l}</span>
          <span className="t"><i style={{ width: `${(r.v / m) * 100}%`, background: PAL[i % PAL.length] }} /></span>
          <b>{fmt ? fmt(r.v) : num(r.v)}</b>
        </div>
      ))}
    </>
  );
}
