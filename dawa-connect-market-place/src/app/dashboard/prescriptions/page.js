"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useRef } from "react";
import { FileText, UploadCloud, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function MyPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchPrescriptions = async () => {
    try {
      const res = await fetch("/api/prescriptions");
      if (res.ok) {
        const data = await res.json();
        setPrescriptions(data.prescriptions);
      }
    } catch (error) {
      console.error("Failed to fetch prescriptions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPrescriptions();
    }
  }, [user]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const file = formData.get("file");
    
    if (!file || file.size === 0) return alert("Please select a file");

    setUploading(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        e.target.reset();
        fetchPrescriptions();
      } else {
        const err = await res.json();
        alert(err.message || "Failed to upload");
      }
    } catch (error) {
      console.error("Upload error", error);
    } finally {
      setUploading(false);
    }
  };

  if (!user) return <div className="py-8 text-center text-red-500">Please log in.</div>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">My Prescriptions</h1>
        <p className="text-sm text-gray-600">Upload and manage your clinical prescriptions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Form */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Upload New</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prescription Title</label>
              <input type="text" name="title" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Monthly Insulin" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File (Image/PDF)</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-blue-600 font-medium">Click to select file</p>
                <input type="file" name="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor's Notes (Optional)</label>
              <textarea name="notes" rows="3" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>

            <button type="submit" disabled={uploading} className="w-full bg-blue-800 text-white font-medium py-2.5 rounded-lg hover:bg-blue-900 disabled:opacity-70 transition-colors">
              {uploading ? "Uploading..." : "Upload Prescription"}
            </button>
          </form>
        </div>

        {/* Prescription List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading prescriptions...</div>
          ) : prescriptions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>No prescriptions uploaded yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {prescriptions.map((p) => (
                  <li key={p._id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900">{p.title}</h3>
                        <p className="text-xs text-gray-500 mb-2">Uploaded on {new Date(p.createdAt).toLocaleDateString()}</p>
                        <a href={p.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
                          <FileText className="w-4 h-4" /> View Document
                        </a>
                      </div>
                      <div>
                        {p.status === "Pending" && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3.5 h-3.5"/> Pending Review</span>}
                        {p.status === "Approved" && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800"><CheckCircle2 className="w-3.5 h-3.5"/> Approved</span>}
                        {p.status === "Rejected" && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3.5 h-3.5"/> Rejected</span>}
                      </div>
                    </div>
                    {p.notes && (
                      <div className="mt-3 bg-gray-50 p-3 rounded text-sm text-gray-600 border border-gray-100">
                        <span className="font-semibold text-gray-700">Notes:</span> {p.notes}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
