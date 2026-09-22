"use client";

import { useAuth } from "@/context/AuthContext";
import { User, Mail } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  if (!user) return <div className="py-8 text-center text-red-500">Please log in.</div>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Account Settings</h1>
        <p className="text-sm text-gray-600">Manage your profile and preferences.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-2xl">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Profile Information</h2>
        
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Avatar</p>
              <button className="text-sm font-medium text-blue-600 hover:underline">Change Avatar</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" readOnly value={user.name} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 cursor-not-allowed" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" readOnly value={user.email} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 cursor-not-allowed" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
