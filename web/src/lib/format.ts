export const usd = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
export const num = (n: number) => Math.round(n).toLocaleString("en-US");
export const short = (v: number) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : String(Math.round(v)));
export const dateGB = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "UTC" });
export const ago = (d: Date) => {
  const m = (Date.now() - d.getTime()) / 6e4;
  return m < 1 ? "just now" : m < 60 ? Math.round(m) + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago";
};
export const nice = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
export const METHODS: Record<string, string> = {
  BANK: "Bank transfer",
  JAZZCASH: "JazzCash",
  EASYPAISA: "Easypaisa",
  CRYPTO_PLISIO: "Crypto (Plisio)",
};
export const planPrice = (p: { kind: string; priceCents: number | null; setupCents: number | null; perPageCents: number | null }) =>
  p.kind === "CUSTOM"
    ? `${usd(p.setupCents ?? 0)} setup + ${usd(p.perPageCents ?? 0)} per page`
    : usd(p.priceCents ?? 0);
