"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { User, Mail, Loader2, Save } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

export default function Settings() {
  const { user, checkUserLoggedIn } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setName(user?.name || ""), [user?.name]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Your profile could not be updated.");
      await checkUserLoggedIn();
      setMessage("Your full name has been updated.");
    } catch (saveError) {
      setError(saveError.message || "Your profile could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <div className="py-8 text-center text-red-500">Please log in.</div>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Account Settings</h1>
        <p className="text-sm text-gray-600">Manage your profile and preferences.</p>
      </div>

      <form onSubmit={saveProfile} className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-2xl">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Profile Information</h2>
        
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
            <UserAvatar user={user} className="h-16 w-16 text-xl" fallbackClassName="bg-blue-100 text-blue-700" />
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Avatar</p>
              <p className="text-sm text-gray-600">{user.picture ? "Managed by your Google account" : "No Google profile image is connected"}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" readOnly value={user.email} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 cursor-not-allowed" />
            </div>
            <p className="mt-1 text-xs text-gray-500">Your verified email address cannot be changed here.</p>
          </div>
          {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{message}</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={saving || name.trim() === user.name} className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save name
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
