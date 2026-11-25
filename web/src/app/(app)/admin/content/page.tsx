import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import PageHead from "@/components/PageHead";
import { ActionForm, Submit } from "@/components/ActionForm";
import { savePaymentInfo, savePlan, saveServices } from "@/app/actions";

export default async function Content() {
  await requireAdmin();
  const [plans, svc, pay] = await Promise.all([
    db.plan.findMany({ orderBy: { sort: "asc" } }),
    db.siteContent.findUnique({ where: { key: "services" } }),
    db.siteContent.findUnique({ where: { key: "paymentInfo" } }),
  ]);
  const info = (pay?.value ?? {}) as Record<string, string>;
  const d = (c: number | null) => (c ?? 0) / 100;
  return (
    <>
      <PageHead title="Content" />
      <h2>Plans</h2>
      {plans.map((p) => (
        <ActionForm key={p.id} action={savePlan} className="card">
          <input type="hidden" name="planId" value={p.id} />
          <div className="grid">
            <label>Name<input name="name" defaultValue={p.name} required /></label>
            <label>Tagline<input name="tagline" defaultValue={p.tagline} /></label>
            {p.kind === "FIXED" ? (
              <label>Price (USD)<input name="price" type="number" step="0.01" min={0} defaultValue={d(p.priceCents)} /></label>
            ) : (
              <>
                <label>Setup (USD)<input name="setup" type="number" step="0.01" min={0} defaultValue={d(p.setupCents)} /></label>
                <label>Per page (USD)<input name="per" type="number" step="0.01" min={0} defaultValue={d(p.perPageCents)} /></label>
              </>
            )}
          </div>
          <label>Features (one per line)<textarea name="features" defaultValue={p.features.join("\n")} /></label>
          <label className="ck"><input type="checkbox" name="active" defaultChecked={p.active} />Visible on the site</label>
          <Submit>Save {p.name}</Submit>
        </ActionForm>
      ))}

      <h2>Services</h2>
      <ActionForm action={saveServices} className="card">
        <p className="muted" style={{ marginTop: 0 }}>JSON list of {"{ title, body, tags[] }"}. Invalid JSON is ignored and nothing is saved.</p>
        <textarea name="json" style={{ minHeight: 240, fontFamily: "ui-monospace,monospace" }} defaultValue={JSON.stringify(svc?.value ?? [], null, 2)} />
        <Submit>Save services</Submit>
      </ActionForm>

      <h2>Payment details shown to clients</h2>
      <ActionForm action={savePaymentInfo} className="card">
        <label>Bank account<textarea name="BANK" defaultValue={info.BANK ?? ""} /></label>
        <label>JazzCash<textarea name="JAZZCASH" defaultValue={info.JAZZCASH ?? ""} /></label>
        <label>Easypaisa<textarea name="EASYPAISA" defaultValue={info.EASYPAISA ?? ""} /></label>
        <Submit>Save payment details</Submit>
      </ActionForm>
    </>
  );
}
