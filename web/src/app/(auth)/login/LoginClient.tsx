"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { initScene, noop, type Scene, type SceneState } from "./scene";
import "./login.css";

type Mode = "login" | "signup";
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const score = (p: string) =>
  [p.length >= 10, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;

export default function LoginClient({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [done, setDone] = useState<{ title: string; text: string } | null>(null);
  const [glOk, setGlOk] = useState(false);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [v, setV] = useState({ lEmail: "", lPass: "", sName: "", sEmail: "", sPass: "" });
  const [err, setErr] = useState<Record<string, string>>({});

  const scene = useRef<Scene>(noop);
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const fLogin = useRef<HTMLDivElement>(null);
  const fSignup = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const set = (s: SceneState) => scene.current.set(s);
  const say = (t: string) => {
    setToast(t);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 2400);
  };

  // 3D scene
  useEffect(() => {
    if (!canvas.current) return;
    const s = initScene(canvas.current);
    if (s) { scene.current = s; setGlOk(true); }
    return () => { scene.current.dispose(); scene.current = noop; };
  }, []);

  // theme
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    scene.current.theme(dark);
  }, [dark]);

  // card height follows the visible face
  const fit = useCallback(() => {
    const f = mode === "login" ? fLogin.current : fSignup.current;
    if (card.current && f) card.current.style.height = f.offsetHeight + "px";
  }, [mode]);
  useLayoutEffect(fit);
  useEffect(() => {
    window.addEventListener("resize", fit);
    document.fonts?.ready.then(fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  // mouse tilt
  useEffect(() => {
    if (!matchMedia("(pointer:fine)").matches) return;
    const on = (e: PointerEvent) => {
      const ex = e.clientX / innerWidth - 0.5, ey = e.clientY / innerHeight - 0.5;
      if (tilt.current) tilt.current.style.transform = `rotateX(${(-ey * 5).toFixed(2)}deg) rotateY(${(ex * 7).toFixed(2)}deg)`;
    };
    addEventListener("pointermove", on, { passive: true });
    return () => removeEventListener("pointermove", on);
  }, []);

  const flip = (to: Mode) => {
    setMode(to);
    setErr({});
    set("idle");
    setTimeout(() => (to === "login" ? fLogin : fSignup).current?.querySelector("input")?.focus({ preventScroll: true }), 500);
  };

  const change = (id: keyof typeof v) => ({
    id,
    value: v[id],
    "aria-invalid": err[id] ? true : false,
    onFocus: () => set(id.endsWith("Pass") ? "password" : "typing"),
    onBlur: () => set("idle"),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setV((o) => ({ ...o, [id]: e.target.value }));
      setErr((o) => ({ ...o, [id]: "" }));
      if (!id.endsWith("Pass")) set("typing");
    },
  });

  const fail = (id: string, msg: string) => {
    setErr((o) => ({ ...o, [id]: msg }));
    setShake(false);
    requestAnimationFrame(() => setShake(true));
    set("error");
    setTimeout(() => set("idle"), 900);
    document.getElementById(id)?.focus();
  };

  const succeed = (title: string, text: string) => {
    setDone({ title, text });
    set("success");
  };

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    if (!emailOk(v.lEmail.trim())) return fail("lEmail", "Enter a valid email address.");
    if (!v.lPass) return fail("lPass", "Enter your password.");
    setBusy("login");
    set("password");
    const res = await signIn("credentials", { email: v.lEmail.trim(), password: v.lPass, redirect: false });
    setBusy(null);
    if (!res || res.error) return fail("lPass", "Wrong email or password.");
    succeed("Welcome back", "Good to see you again.");
  }

  async function submitSignup(e: FormEvent) {
    e.preventDefault();
    if (v.sName.trim().length < 2) return fail("sName", "Enter your name.");
    if (!emailOk(v.sEmail.trim())) return fail("sEmail", "Enter a valid email address.");
    if (v.sPass.length < 10) return fail("sPass", "Use at least 10 characters.");
    setBusy("signup");
    set("password");
    const r = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: v.sName.trim(), email: v.sEmail.trim(), password: v.sPass }),
    });
    if (!r.ok) {
      setBusy(null);
      const j = await r.json().catch(() => ({}));
      return fail("sEmail", j.error ?? "Could not create the account.");
    }
    const res = await signIn("credentials", { email: v.sEmail.trim(), password: v.sPass, redirect: false });
    setBusy(null);
    if (res?.error) return fail("sEmail", "Account created. Please log in.");
    succeed("Account created", `Nice to meet you, ${v.sName.trim()}. Your dashboard is ready.`);
  }

  const google = () => (googleEnabled ? signIn("google", { redirectTo: "/dashboard" }) : say("Google login is not set up yet."));
  const goDash = () => { router.push("/dashboard"); router.refresh(); };

  const eye = (id: string) => (
    <button className="eye" type="button" aria-label={show[id] ? "Hide password" : "Show password"}
      onClick={() => setShow((o) => ({ ...o, [id]: !o[id] }))}>
      {show[id] ? "Hide" : "Show"}
    </button>
  );
  const s = v.sPass.length < 10 ? Math.min(score(v.sPass), 1) : score(v.sPass);
  const hint = !v.sPass ? "Use at least 10 characters."
    : v.sPass.length < 10 ? `${10 - v.sPass.length} more character${10 - v.sPass.length === 1 ? "" : "s"} needed.`
    : ["", "Weak", "Okay", "Good", "Strong"][s] + ". Mix upper and lower case, numbers and symbols.";

  return (
    <div className={glOk ? "gl-ok" : ""} style={{ display: "contents" }}>
      <canvas id="gl" ref={canvas} aria-hidden="true" style={{ display: glOk ? "block" : "none" }} />
      {!glOk && (
        <div className="fb" aria-hidden="true" style={{ display: "block" }}>
          <div className="orb a" /><div className="orb b" />
          <div className="cube"><i /><i /><i /><i /><i /><i /></div>
        </div>
      )}
      <div className="tools">
        <button type="button" aria-label="Switch light or dark theme" onClick={() => setDark((d) => !d)}>◐</button>
      </div>

      <main className="page">
        <section className="brand">
          <span className="logo">Arhan<b>.pk</b></span>
          <h1>Your projects, in one place.</h1>
          <p>Track progress, send payment proof, download invoices and message me when you need help.</p>
          <ul className="feats"><li>Live project status</li><li>Simple payment proof upload</li><li>Support tickets with replies</li></ul>
        </section>

        <section className="authwrap">
          <div className={"sh" + (shake ? " shake" : "")}>
            <div className="tilt" ref={tilt}>
              <div className={"card3d" + (mode === "signup" ? " flipped" : "")} ref={card}>

                <div className="face" ref={fLogin} inert={mode !== "login"}>
                  <h2>Welcome back</h2><p className="sub">Log in to your dashboard.</p>
                  <form noValidate onSubmit={submitLogin}>
                    <div className="field"><label htmlFor="lEmail">Email</label>
                      <input type="email" autoComplete="email" inputMode="email" {...change("lEmail")} />
                      <p className="err" aria-live="polite">{err.lEmail}</p></div>
                    <div className="field"><label htmlFor="lPass">Password</label>
                      <div className="in"><input type={show.lPass ? "text" : "password"} autoComplete="current-password" {...change("lPass")} />{eye("lPass")}</div>
                      <p className="err" aria-live="polite">{err.lPass}</p></div>
                    <div className="row"><span></span><button className="l" type="button" onClick={() => say("Password reset by email comes later.")}>Forgot password?</button></div>
                    <button className={"b" + (busy === "login" ? " busy" : "")} type="submit">Log in</button>
                  </form>
                  <div className="or">or</div>
                  <button className="b g" type="button" onClick={google}>Continue with Google</button>
                  <p className="switch">New here? <button className="l" type="button" onClick={() => flip("signup")}>Create an account</button></p>
                </div>

                <div className="face back" ref={fSignup} inert={mode !== "signup"}>
                  <h2>Create your account</h2><p className="sub">Order a plan and follow your project.</p>
                  <form noValidate onSubmit={submitSignup}>
                    <div className="field"><label htmlFor="sName">Name</label>
                      <input type="text" autoComplete="name" {...change("sName")} />
                      <p className="err" aria-live="polite">{err.sName}</p></div>
                    <div className="field"><label htmlFor="sEmail">Email</label>
                      <input type="email" autoComplete="email" inputMode="email" {...change("sEmail")} />
                      <p className="err" aria-live="polite">{err.sEmail}</p></div>
                    <div className="field"><label htmlFor="sPass">Password</label>
                      <div className="in"><input type={show.sPass ? "text" : "password"} autoComplete="new-password" {...change("sPass")} />{eye("sPass")}</div>
                      <div className="meter" data-s={v.sPass ? s : 0}><i /><i /><i /><i /></div>
                      <p className="hint">{hint}</p>
                      <p className="err" aria-live="polite">{err.sPass}</p></div>
                    <button className={"b" + (busy === "signup" ? " busy" : "")} type="submit">Create account</button>
                  </form>
                  <div className="or">or</div>
                  <button className="b g" type="button" onClick={google}>Sign up with Google</button>
                  <p className="switch">Have an account? <button className="l" type="button" onClick={() => flip("login")}>Log in</button></p>
                </div>

              </div>
            </div>
          </div>
        </section>
      </main>

      <div id="ok" className={done ? "on" : ""} role="dialog" aria-modal="true" aria-labelledby="okT">
        <div className="okc">
          <svg viewBox="0 0 84 84" aria-hidden="true"><circle className="ring" cx="42" cy="42" r="38" /><path className="tick" d="M26 43l11 11 21-24" /></svg>
          <h2 id="okT">{done?.title}</h2><p>{done?.text}</p>
          <button className="b" type="button" onClick={goDash}>Continue to dashboard</button>
        </div>
      </div>
      <div id="toast" role="status" className={toast ? "on" : ""}>{toast}</div>
    </div>
  );
}
