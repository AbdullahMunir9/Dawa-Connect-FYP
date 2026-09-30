"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import GoogleIdentityButton from "@/components/auth/GoogleIdentityButton";
import { authPageHref, safeAuthRedirect } from "@/lib/authRedirect.mjs";

const inputClass =
  "mt-2 block w-full rounded-lg border border-gray-200 bg-white px-4 py-[0.7rem] text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#009688]";
const strongPasswordPattern = "^(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$";

function secondsUntil(value, now) {
  return value ? Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000)) : 0;
}

function clockLabel(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [phase, setPhase] = useState("details");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/");
  const [now, setNow] = useState(() => Date.now());
  const { signup, verifySignupOtp, resendSignupOtp, googleAuthenticate } = useAuth();

  useEffect(() => {
    setNextPath(safeAuthRedirect(new URLSearchParams(window.location.search).get("next")));
  }, []);

  useEffect(() => {
    if (phase !== "verify") return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "verify" || !challenge?.challengeId) return undefined;
    let cancelled = false;
    const checkDelivery = async () => {
      try {
        const response = await fetch(`/api/auth/signup/status?challengeId=${encodeURIComponent(challenge.challengeId)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (data.status) {
          setChallenge((current) => current ? {
            ...current,
            deliveryStatus: data.status,
            expiresAt: data.expiresAt || current.expiresAt,
            resendAvailableAt: data.resendAvailableAt || current.resendAvailableAt,
          } : current);
        }
        if (["bounced", "failed", "expired"].includes(data.status)) {
          setError(data.message || "The verification email could not be delivered.");
        }
      } catch {
        // Delivery polling is supplementary; OTP verification remains available.
      }
    };
    const timer = setInterval(checkDelivery, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [challenge?.challengeId, phase]);

  const expiresIn = useMemo(() => secondsUntil(challenge?.expiresAt, now), [challenge?.expiresAt, now]);
  const resendIn = useMemo(() => secondsUntil(challenge?.resendAvailableAt, now), [challenge?.resendAvailableAt, now]);
  const deliveryFailed = ["bounced", "failed", "expired"].includes(challenge?.deliveryStatus);

  const handleGoogle = async (credential) => {
    setError("");
    const result = await googleAuthenticate(credential, "signup", nextPath);
    if (!result.success) setError(result.message || "Google registration failed.");
    return result;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const result = await signup(name, email, password, phone, city, nextPath);
    if (!result.success) {
      setError(result.message || "Registration could not be started.");
      setLoading(false);
      return;
    }
    setChallenge({
      challengeId: result.challengeId,
      maskedEmail: result.maskedEmail,
      expiresAt: result.expiresAt,
      resendAvailableAt: result.resendAvailableAt,
      deliveryStatus: "sent",
    });
    setPassword("");
    setOtp("");
    setNow(Date.now());
    setNotice("A six-digit verification code has been sent.");
    setPhase("verify");
    setLoading(false);
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!challenge?.challengeId || otp.length !== 6) return;
    setLoading(true);
    setError("");
    setNotice("");
    const result = await verifySignupOtp(challenge.challengeId, otp, nextPath);
    if (!result.success) setError(result.message || "The verification code is incorrect.");
    setLoading(false);
  };

  const handleResend = async () => {
    if (!challenge?.challengeId || resendIn > 0 || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    const result = await resendSignupOtp(challenge.challengeId);
    if (!result.success) {
      setError(result.message || "Another code could not be sent.");
      setLoading(false);
      return;
    }
    setChallenge((current) => ({
      ...current,
      expiresAt: result.expiresAt,
      resendAvailableAt: result.resendAvailableAt,
      deliveryStatus: "sent",
    }));
    setOtp("");
    setNow(Date.now());
    setNotice("A new six-digit code has been sent.");
    setLoading(false);
  };

  const editDetails = () => {
    setPhase("details");
    setChallenge(null);
    setOtp("");
    setError("");
    setNotice("");
  };

  return (
    <AuthSplitLayout
      heading={phase === "verify" ? "Verify your email" : "Create your marketplace account"}
      subheading={phase === "verify" ? "One secure step before your account is created" : "Register to buy healthcare products"}
    >
      {phase === "verify" ? (
        <form className="space-y-6" onSubmit={handleVerify}>
          <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-teal-700 shadow-sm"><MailCheck className="h-6 w-6" /></span>
            <p className="mt-3 text-sm font-semibold text-gray-900">Check {challenge?.maskedEmail}</p>
            <p className="mt-1 text-xs leading-5 text-gray-600">Enter the code from DawaConnect. Receiving and entering it confirms that you control this inbox.</p>
          </div>

          {error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">{error}</div>}
          {notice && <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

          <div>
            <label htmlFor="signup-otp" className="block text-center text-sm font-medium text-gray-700">Six-digit verification code</label>
            <input
              id="signup-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mx-auto mt-3 block w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-[#009688]"
              placeholder="000000"
              aria-describedby="otp-expiry"
            />
            <p id="otp-expiry" className={`mt-3 flex items-center justify-center gap-1.5 text-xs font-medium ${expiresIn ? "text-gray-500" : "text-red-600"}`}>
              <Clock3 className="h-3.5 w-3.5" />
              {expiresIn ? `Code expires in ${clockLabel(expiresIn)}` : "Code expired — request a new one"}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6 || expiresIn === 0 || deliveryFailed}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-teal-900/20 transition hover:from-teal-700 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <ShieldCheck className="h-4 w-4" /> {loading ? "Verifying..." : "Verify and create account"}
          </button>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-5 sm:flex-row">
            <button type="button" onClick={editDetails} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Change email</button>
            <button type="button" onClick={handleResend} disabled={loading || resendIn > 0} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:cursor-not-allowed disabled:text-gray-400"><RefreshCw className="h-4 w-4" />{resendIn ? `Resend in ${resendIn}s` : "Resend code"}</button>
          </div>
          <p className="text-center text-xs leading-5 text-gray-500">The email may take a moment to arrive. Check your spam or promotions folder as well.</p>
        </form>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">{error}</div>}
          <div><label htmlFor="signup-name" className="text-sm font-medium text-gray-700">Full name</label><input id="signup-name" type="text" required autoComplete="name" maxLength={60} className={inputClass} placeholder="Ahmad Khan" value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div><label htmlFor="signup-email" className="text-sm font-medium text-gray-700">Email Address</label><input id="signup-email" type="email" required autoComplete="email" maxLength={254} className={inputClass} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div><label htmlFor="signup-phone" className="text-sm font-medium text-gray-700">Phone Number</label><input id="signup-phone" type="tel" required autoComplete="tel" maxLength={40} className={inputClass} placeholder="+92 300 1234567" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
          <div><label htmlFor="signup-city" className="text-sm font-medium text-gray-700">City</label><input id="signup-city" type="text" required autoComplete="address-level2" maxLength={100} className={inputClass} placeholder="Lahore" value={city} onChange={(event) => setCity(event.target.value)} /></div>
          <div>
            <label htmlFor="signup-password" className="text-sm font-medium text-gray-700">Password</label>
            <input id="signup-password" type="password" required autoComplete="new-password" minLength={8} pattern={strongPasswordPattern} className={inputClass} title="At least 8 characters, including 1 uppercase letter, 1 number, and 1 special character" placeholder="Min 8 chars, Aa1@..." value={password} onChange={(event) => setPassword(event.target.value)} />
            <p className="mt-2 text-xs text-gray-500">Use at least 8 characters with 1 uppercase letter, 1 number, and 1 special character.</p>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-gradient-to-r from-teal-500 via-teal-600 to-teal-700 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-teal-900/25 transition hover:from-teal-600 hover:to-teal-800 disabled:opacity-65">{loading ? "Sending verification code..." : "Continue with email"}</button>
          <div className="flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-gray-200" /><span className="text-xs font-medium uppercase tracking-wider text-gray-400">or</span><span className="h-px flex-1 bg-gray-200" /></div>
          <GoogleIdentityButton intent="signup" onCredential={handleGoogle} onError={setError} />
          <p className="text-center text-sm text-gray-500">Already have an account? <Link href={authPageHref("/login", nextPath)} className="font-semibold text-[#009688] hover:text-[#00796b]">Sign in here</Link></p>
        </form>
      )}
    </AuthSplitLayout>
  );
}
