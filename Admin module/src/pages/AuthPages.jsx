import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, ClipboardCheck, MessageSquareWarning, ShoppingBag, ScrollText, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AdminAPI, errorMessage } from "../lib/api";
import { Button, Field, Input } from "../components/ui/primitives";
import { cn } from "../lib/format";

const FEATURES = [
  { icon: ClipboardCheck, title: "Pharmacy onboarding", text: "Review registrations, approve or reject with a reason." },
  { icon: ShoppingBag, title: "Order oversight", text: "Follow every marketplace order and its pharmacy fulfillments." },
  { icon: MessageSquareWarning, title: "Complaints desk", text: "Handle escalations from pharmacies and customers in one inbox." },
  { icon: ScrollText, title: "Audit trail", text: "Every admin action is recorded with who, what and when." },
];

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between xl:p-16">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-brand-400/20 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur"><ShieldCheck className="h-6 w-6" /></span>
          <div><p className="text-lg font-bold tracking-tight">DawaConnect</p><p className="text-xs text-white/60">Admin console</p></div>
        </div>
        <h2 className="mt-14 max-w-md text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">Run the marketplace with confidence.</h2>
        <p className="mt-4 max-w-md text-[15px] leading-7 text-white/70">One place to onboard pharmacies, watch orders, resolve complaints and keep a clear record of every decision.</p>
        <ul className="mt-10 space-y-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3.5">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15"><f.icon className="h-4.5 w-4.5" /></span>
              <div><p className="text-sm font-semibold">{f.title}</p><p className="text-[13px] text-white/60">{f.text}</p></div>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-xs text-white/40">Restricted to authorised DawaConnect administrators.</p>
    </div>
  );
}

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <BrandPanel />
      <div className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px] animate-in">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span className="text-base font-bold tracking-tight text-ink">DawaConnect Admin</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer && <p className="mt-8 text-center text-sm text-muted">{footer}</p>}
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, placeholder = "••••••••", autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <Input id={id} type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} required
      trailing={<button type="button" onClick={() => setShow((v) => !v)} className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
  );
}

function Notice({ tone = "error", children }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div role="alert" className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", tone === "error" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200")}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" /><span>{children}</span>
    </div>
  );
}

export function LoginPage() {
  const { admin, login, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => () => clearSessionMessage(), [clearSessionMessage]);
  if (admin) return <Navigate to={location.state?.from || "/"} replace />;

  async function submit(event) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to the DawaConnect admin console." footer={<>Need an admin account? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Request access</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {sessionMessage && !error && <Notice>{sessionMessage}</Notice>}
        {error && <Notice>{error}</Notice>}
        <Field label="Email address" htmlFor="login-email">
          <Input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@dawaconnect.pk" />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <PasswordInput id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
        <p className="text-center text-xs text-subtle">Forgot your password? Ask a super admin to reset your account.</p>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const strong = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
  if (admin) return <Navigate to="/" replace />;

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const checks = [
    { ok: form.password.length >= 8, label: "8+ characters" },
    { ok: /[A-Z]/.test(form.password), label: "an uppercase letter" },
    { ok: /[^A-Za-z0-9]/.test(form.password), label: "a special character" },
  ];

  async function submit(event) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!strong.test(form.password)) { setError("Password must be at least 8 characters and include an uppercase letter and a special character."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const data = await AdminAPI.signup({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      setMessage(data.message);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Request admin access" subtitle="New accounts stay pending until a super admin approves them." footer={<>Already have access? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice>{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <Field label="Full name" htmlFor="reg-name"><Input id="reg-name" required autoComplete="name" value={form.name} onChange={set("name")} placeholder="Your name" /></Field>
        <Field label="Work email" htmlFor="reg-email"><Input id="reg-email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@dawaconnect.pk" /></Field>
        <Field label="Password" htmlFor="reg-password">
          <PasswordInput id="reg-password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {checks.map((c) => <li key={c.label} className={cn("inline-flex items-center gap-1", c.ok ? "text-emerald-600" : "text-subtle")}><CheckCircle2 className="h-3 w-3" />{c.label}</li>)}
          </ul>
        </Field>
        <Field label="Confirm password" htmlFor="reg-confirm"><PasswordInput id="reg-confirm" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter password" autoComplete="new-password" /></Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Create account</Button>
      </form>
    </AuthLayout>
  );
}
