import { db } from "@/lib/db";
import PortfolioScript from "./PortfolioScript";
import { CTL, POST, PRE, TOP } from "./static-html";

export const dynamic = "force-dynamic";

type Service = { title: string; body: string; tags: string[] };
const span = (i: number) => (((i + 1) >> 1) % 2 === 0 ? "c7" : "c5");
const dollars = (c: number | null) => (c ?? 0) / 100;
const money = (c: number | null) => "$" + dollars(c).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default async function Home() {
  const [plans, svc] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    db.siteContent.findUnique({ where: { key: "services" } }),
  ]);
  const services = (Array.isArray(svc?.value) ? svc.value : []) as Service[];
  const raw = (html: string) => <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;

  return (
    <>
      {raw(PRE)}
      <div className="wrap">
        {raw(TOP)}

        <section id="services">
          <h2 className="piece plain" data-p="" style={{ display: "inline-block", padding: "2px 10px" }}>Services</h2>
          <p className="piece plain lead" data-p="">From a single landing page to a full store with an admin dashboard, I design it, build it and host it.</p>
          <div className="bento">
            {services.map((s, i) => (
              <article key={s.title + i} className={`piece card lift svc ${i === 0 ? "feature " : ""}${span(i)}`} data-p="">
                <h3>{s.title}</h3>
                <p className="muted">{s.body}</p>
                <ul className="chips">{s.tags.map((t) => <li key={t}>{t}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section id="plans">
          <h2 className="piece plain" data-p="" style={{ display: "inline-block", padding: "2px 10px" }}>Plans</h2>
          <p className="piece plain lead" data-p="">Fixed prices in US dollars. Need something in between? Use the custom plan.</p>
          <div className="plans">
            {plans.map((p, i) => {
              const custom = p.kind === "CUSTOM";
              return (
                <article key={p.id} className={`piece lift plan${i === 1 ? " feat" : ""}`} data-p="" id={custom ? "custom" : undefined}>
                  <h3>{p.name}</h3>
                  <p className="muted" style={{ margin: 0 }}>{p.tagline}</p>
                  <div className="price" id={custom ? "cprice" : undefined} aria-live={custom ? "polite" : undefined}>
                    {custom ? money((p.setupCents ?? 0) + (p.perPageCents ?? 0) * 8) : money(p.priceCents)}
                  </div>
                  <small className="muted">{custom ? `${money(p.setupCents)} setup + ${money(p.perPageCents)} per page` : "one-time"}</small>
                  {custom && (
                    <>
                      <label htmlFor="pages">Pages: <b id="pcount">8</b></label>
                      <input id="pages" type="range" min={1} max={30} defaultValue={8}
                        data-setup={dollars(p.setupCents)} data-per={dollars(p.perPageCents)} />
                    </>
                  )}
                  <ul className="feat">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                  <a className="btn" href={`/dashboard/order?plan=${p.slug}`}>{custom ? "Get a custom quote" : `Get ${p.name}`}</a>
                </article>
              );
            })}
          </div>
        </section>

        {raw(POST)}
      </div>
      {raw(CTL)}
      <PortfolioScript />
    </>
  );
}
