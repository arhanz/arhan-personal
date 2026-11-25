import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { METHODS, planPrice } from "@/lib/format";
import PageHead from "@/components/PageHead";
import { ActionForm, Submit } from "@/components/ActionForm";
import { placeOrder } from "@/app/actions";

export default async function OrderPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  await requireClient();
  const want = (await searchParams).plan;
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
  const pick = plans.find((p) => p.slug === want)?.slug ?? plans[0]?.slug;
  return (
    <>
      <PageHead title="Order a plan" />
      <ActionForm action={placeOrder} className="card">
        <p><strong>Plan</strong></p>
        {plans.map((p) => (
          <label className="ck" key={p.id} style={{ alignItems: "flex-start" }}>
            <input type="radio" name="plan" value={p.slug} defaultChecked={p.slug === pick} style={{ marginTop: 5 }} />
            <span><strong>{p.name}</strong> · {planPrice(p)}<br /><span className="muted">{p.tagline}</span></span>
          </label>
        ))}
        <label>Pages (Custom plan only)<input name="pages" type="number" min={1} max={30} defaultValue={5} /></label>
        <label>Payment method
          <select name="method">{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <p className="muted">The final price is calculated from the plan you choose.</p>
        <Submit>Place order</Submit>
      </ActionForm>
    </>
  );
}
