"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import GoogleIdentityButton from "@/components/auth/GoogleIdentityButton";

const inputClass =
  "mt-2 block w-full rounded-lg border border-gray-200 bg-white px-4 py-[0.7rem] text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#009688]";
const strongPasswordPattern = "^(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup, googleAuthenticate } = useAuth();

  const handleGoogle = async (credential) => {
    setError("");
    const result = await googleAuthenticate(credential, "signup", "/dashboard");
    if (!result.success) setError(result.message || "Google registration failed.");
    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signup(name, email, password, phone, city);
    if (!res.success) {
      setError(res.message || "An error occurred during signup");
    }
    setLoading(false);
  };

  return (
    <AuthSplitLayout
      heading="Create your marketplace account 👋"
      subheading="Register to buy healthcare products"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}
        <div>
          <label
            htmlFor="signup-name"
            className="text-sm font-medium text-gray-700"
          >
            Full name
          </label>
          <input
            id="signup-name"
            type="text"
            required
            autoComplete="name"
            className={inputClass}
            placeholder="Dr. Ahmad Khan"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="signup-email"
            className="text-sm font-medium text-gray-700"
          >
            Email Address
          </label>
          <input
            id="signup-email"
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
            htmlFor="signup-phone"
            className="text-sm font-medium text-gray-700"
          >
            Phone Number
          </label>
          <input
            id="signup-phone"
            type="tel"
            required
            autoComplete="tel"
            className={inputClass}
            placeholder="+92 300 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="signup-city"
            className="text-sm font-medium text-gray-700"
          >
            City
          </label>
          <input
            id="signup-city"
            type="text"
            required
            autoComplete="address-level2"
            className={inputClass}
            placeholder="Lahore"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="signup-password"
            className="text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            pattern={strongPasswordPattern}
            className={inputClass}
            title="At least 8 characters, including 1 uppercase letter, 1 number, and 1 special character"
            placeholder="Min 8 chars, Aa1@..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-500">
            Use at least 8 characters with 1 uppercase letter, 1 number, and 1
            special character.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-3.5 text-[15px] font-bold tracking-tight text-white shadow-lg shadow-teal-900/25 transition-opacity hover:opacity-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009688] disabled:opacity-65"
          style={{
            background:
              "linear-gradient(135deg, #26a69a 0%, #009688 50%, #00796b 100%)",
          }}
        >
          {loading ? "Creating account..." : "Create marketplace account"}
        </button>
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">or</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <GoogleIdentityButton intent="signup" onCredential={handleGoogle} onError={setError} />
        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#009688] hover:text-[#00796b]"
          >
            Sign in here
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
