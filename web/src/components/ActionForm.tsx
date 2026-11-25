"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode, SelectHTMLAttributes } from "react";

export type State = { ok?: string; error?: string; n?: number };
const Pending = createContext(false);

export function ActionForm({
  action, children, className, resetOnOk,
}: {
  action: (s: State, f: FormData) => Promise<State>;
  children: ReactNode;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, run, pending] = useActionState(action, {} as State);
  const ref = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);

  useEffect(() => {
    if (!state.n) return;
    setMsg(state.error ? { t: state.error, bad: true } : state.ok ? { t: state.ok, bad: false } : null);
    if (state.ok && resetOnOk) ref.current?.reset();
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [state, resetOnOk]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); // calling the action by hand keeps typed values and the chosen file after an error
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => run(fd));
  }

  return (
    <Pending.Provider value={pending}>
      <form ref={ref} onSubmit={onSubmit} className={className}>
        {children}
        {msg && <div role="status" className={"ftoast on" + (msg.bad ? " bad" : "")}>{msg.t}</div>}
      </form>
    </Pending.Provider>
  );
}

export function Submit({ children, className, name, value, disabled }: { children: ReactNode; className?: string; name?: string; value?: string; disabled?: boolean }) {
  const pending = useContext(Pending);
  return (
    <button className={"b " + (className ?? "")} name={name} value={value} disabled={pending || disabled}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function AutoSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

export function ReviewPanel({ action, orderId, amount }: { action: (s: State, f: FormData) => Promise<State>; orderId: string; amount: string }) {
  const [c, setC] = useState([false, false, false]);
  const all = c.every(Boolean);
  const labels = [`Screenshot shows ${amount} received`, "Account name matches the screenshot", "Transaction ID matches the screenshot"];
  return (
    <ActionForm action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      <p style={{ margin: "14px 0 6px" }}><strong>Check before confirming</strong></p>
      {labels.map((l, i) => (
        <label className="ck" key={i}>
          <input type="checkbox" checked={c[i]} onChange={() => setC(c.map((x, j) => (j === i ? !x : x)))} />{l}
        </label>
      ))}
      <Submit name="decision" value="confirm" disabled={!all}>Confirm payment</Submit>
      <label style={{ marginTop: 14 }}>Reason if rejecting
        <textarea name="reason" maxLength={300} placeholder="Example: the amount does not match" />
      </label>
      <Submit name="decision" value="reject" className="g">Reject payment</Submit>
    </ActionForm>
  );
}
