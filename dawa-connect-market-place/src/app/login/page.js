"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import GoogleIdentityButton from "@/components/auth/GoogleIdentityButton";

const inputClass =
  "mt-2 block w-full rounded-lg border border-gray-200 bg-white px-4 py-[0.7rem] text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#009688]";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, googleAuthenticate } = useAuth();

  const handleGoogle = async (credential) => {
    setError("");
    const nextPath = new URLSearchParams(window.location.search).get("next") || "/";
    const result = await googleAuthenticate(credential, "login", nextPath);
    if (!result.success) setError(result.message || "Google sign-in failed.");
    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const nextPath = new URLSearchParams(window.location.search).get("next") || "/";
    const res = await login(email, password, nextPath);
    if (!res.success) {
      setError(res.message || "An error occurred during login");
    }
    setLoading(false);
  };

  return (
    <AuthSplitLayout
      heading="Welcome back 👋"
      subheading="Sign in to continue your marketplace journey"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}
        <div>
          <label
            htmlFor="login-email"
            className="text-sm font-medium text-gray-700"
          >
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            placeholder="seller@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent p-0 text-sm font-medium text-[#009688] hover:text-[#00796b] hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-3.5 text-[15px] font-bold tracking-tight text-white shadow-lg shadow-teal-900/25 transition-opacity hover:opacity-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009688] disabled:opacity-65"
          style={{
            background: "linear-gradient(135deg, #26a69a 0%, #009688 50%, #00796b 100%)",
          }}
        >
          {loading ? "Signing in..." : "Sign in to marketplace"}
        </button>
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">or</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <GoogleIdentityButton intent="login" onCredential={handleGoogle} onError={setError} />
        <p className="text-center text-sm text-gray-500">
          New here?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#009688] hover:text-[#00796b]"
          >
            Register here
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
