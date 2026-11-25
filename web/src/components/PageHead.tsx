export default function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="head">
      <h1>{title}</h1>
      {children && <div className="ctl">{children}</div>}
    </div>
  );
}
