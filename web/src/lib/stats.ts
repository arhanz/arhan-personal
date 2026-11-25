export const DAY = 864e5;
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export function lastDays(R: number) {
  const out: string[] = [];
  const now = Date.now();
  for (let k = R - 1; k >= 0; k--) out.push(dayKey(new Date(now - k * DAY)));
  return out;
}
export const dayLabel = (k: string) =>
  new Date(k + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const delta = (c: number, p: number) => (p ? ((c - p) / p) * 100 : null);
export function parseRange(v: string | undefined) {
  const n = Number(v);
  return n === 7 || n === 90 ? n : 30;
}
export function refName(ref: string | null) {
  if (!ref) return "Direct";
  const h = ref.toLowerCase();
  if (/google|bing|duckduckgo/.test(h)) return "Search engines";
  if (/linkedin/.test(h)) return "LinkedIn";
  if (/facebook|instagram|twitter|x\.com|t\.co|tiktok|youtube/.test(h)) return "Social media";
  return h.slice(0, 40);
}
export function tally<T>(items: T[], key: (x: T) => string) {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v);
}
