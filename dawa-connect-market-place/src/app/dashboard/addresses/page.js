"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { MapPin, Trash2, CheckCircle2 } from "lucide-react";

const initialForm = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  province: "",
  postalCode: "",
  isDefault: false,
};

export default function AddressesPage() {
  const { user, checkUserLoggedIn } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchAddresses = async () => {
    try {
      const response = await fetch("/api/user/addresses");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load addresses");
      setAddresses(data.addresses || []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchAddresses();
  }, [user]);

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/user/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to add address");
      setAddresses(data.addresses || []);
      setForm(initialForm);
      checkUserLoggedIn();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (addressId) => {
    const response = await fetch("/api/user/addresses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressId, action: "set-default" }),
    });
    const data = await response.json();
    if (response.ok) {
      setAddresses(data.addresses || []);
      checkUserLoggedIn();
    }
  };

  const deleteAddress = async (addressId) => {
    const response = await fetch(`/api/user/addresses?id=${addressId}`, { method: "DELETE" });
    const data = await response.json();
    if (response.ok) {
      setAddresses(data.addresses || []);
      checkUserLoggedIn();
    }
  };

  if (!user) return <div className="py-8 text-center text-red-500">Please log in.</div>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Manage Addresses</h1>
        <p className="text-sm text-gray-600">Add multiple delivery addresses and choose your default.</p>
      </div>

      <form onSubmit={handleCreateAddress} className="bg-white border border-gray-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input value={form.label} onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Label (Home/Office)" className="border border-gray-200 rounded-lg px-3 py-2" required />
        <input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} placeholder="Full Name" className="border border-gray-200 rounded-lg px-3 py-2" required />
        <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" className="border border-gray-200 rounded-lg px-3 py-2" required />
        <input value={form.line1} onChange={(e) => setForm((prev) => ({ ...prev, line1: e.target.value }))} placeholder="Address Line 1" className="border border-gray-200 rounded-lg px-3 py-2" required />
        <input value={form.line2} onChange={(e) => setForm((prev) => ({ ...prev, line2: e.target.value }))} placeholder="Address Line 2 (optional)" className="border border-gray-200 rounded-lg px-3 py-2" />
        <input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="City" className="border border-gray-200 rounded-lg px-3 py-2" required />
        <input value={form.province} onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))} placeholder="Province/State" className="border border-gray-200 rounded-lg px-3 py-2" />
        <input value={form.postalCode} onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))} placeholder="Postal Code" className="border border-gray-200 rounded-lg px-3 py-2" />
        <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))} />
          Set as default address
        </label>
        <div className="md:col-span-2 flex justify-end">
          <button disabled={saving} className="bg-blue-800 text-white px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50">
            {saving ? "Saving..." : "Add Address"}
          </button>
        </div>
      </form>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Loading addresses...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div key={address._id} className={`border rounded-lg p-5 ${address.isDefault ? "border-blue-600 bg-blue-50/20" : "border-gray-200"}`}>
              <div className="flex justify-between items-start">
                <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{address.label}</span>
                {address.isDefault && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
              </div>
              <h3 className="font-semibold text-gray-900 mt-3">{address.fullName}</h3>
              <p className="text-sm text-gray-600">{address.line1}</p>
              {address.line2 ? <p className="text-sm text-gray-600">{address.line2}</p> : null}
              <p className="text-sm text-gray-600">{address.city}{address.province ? `, ${address.province}` : ""} {address.postalCode}</p>
              <p className="text-sm font-medium text-gray-900 mt-2">{address.phone}</p>
              <div className="flex gap-4 mt-4">
                {!address.isDefault && (
                  <button onClick={() => setDefault(address._id)} className="text-blue-600 text-sm font-medium hover:underline">
                    Set Default
                  </button>
                )}
                <button onClick={() => deleteAddress(address._id)} className="text-red-600 text-sm font-medium hover:underline inline-flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
