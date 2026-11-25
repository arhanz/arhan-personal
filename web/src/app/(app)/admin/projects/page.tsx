import { ProjectStage } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import PageHead from "@/components/PageHead";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveProject } from "@/app/actions";

export default async function Projects() {
  await requireAdmin();
  const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" }, take: 40, include: { order: { include: { user: true } } } });
  return (
    <>
      <PageHead title="Projects" />
      <p className="muted">A project is created automatically when you confirm a payment.</p>
      {projects.map((p) => (
        <ActionForm key={p.id} action={saveProject} className="card">
          <input type="hidden" name="orderId" value={p.orderId} />
          <strong>{p.title}</strong> <span className="muted">for {p.order.user.name || p.order.user.email}</span>
          <div className="bar"><i style={{ width: `${p.progress}%` }} /></div>
          <div className="row" style={{ marginTop: 10 }}>
            <label>Stage<select name="stage" defaultValue={p.stage}>{Object.values(ProjectStage).map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Progress %<input name="progress" type="number" min={0} max={100} defaultValue={p.progress} /></label>
          </div>
          <label>Live URL (https)<input name="url" defaultValue={p.liveUrl ?? ""} maxLength={200} /></label>
          <Submit>Save</Submit>
        </ActionForm>
      ))}
      {!projects.length && <p className="muted">No projects yet.</p>}
    </>
  );
}
