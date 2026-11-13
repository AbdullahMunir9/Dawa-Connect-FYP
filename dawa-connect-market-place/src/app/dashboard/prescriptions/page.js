"use client";

import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, UploadCloud, Trash2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";

const MAX_PRESCRIPTIONS = 15;
const MAX_BYTES = 4 * 1024 * 1024;

export default function MyPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [notice, setNotice] = useState(null);
  const fileInputRef = useRef(null);

  const fetchPrescriptions = useCallback(async () => {
    try {
      const response = await fetch("/api/prescriptions", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Prescriptions could not be loaded.");
      setPrescriptions(data.prescriptions || []);
    } catch (error) { setNotice({ tone: "error", message: error.message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) void fetchPrescriptions(); }, [fetchPrescriptions, user]);

  async function handleUpload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!file?.size) return setNotice({ tone: "error", message: "Choose a prescription file first." });
    if (file.size > MAX_BYTES) return setNotice({ tone: "error", message: "Prescription files must be 4 MB or smaller." });
    setUploading(true); setNotice(null);
    try {
      const response = await fetch("/api/prescriptions", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Prescription upload failed.");
      setPrescriptions((current) => [data.prescription, ...current]);
      setNotice({ tone: "success", message: "Prescription uploaded securely." });
      form.reset(); setSelectedName("");
    } catch (error) { setNotice({ tone: "error", message: error.message }); }
    finally { setUploading(false); }
  }

  async function removePrescription(prescription) {
    if (!window.confirm(`Delete “${prescription.title}”? This cannot be undone.`)) return;
    setDeletingId(prescription._id); setNotice(null);
    try {
      const response = await fetch(`/api/prescriptions/${encodeURIComponent(prescription._id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Prescription could not be deleted.");
      setPrescriptions((current) => current.filter((item) => item._id !== prescription._id));
      setNotice({ tone: "success", message: "Prescription deleted." });
    } catch (error) { setNotice({ tone: "error", message: error.message }); }
    finally { setDeletingId(""); }
  }

  if (!user) return <div className="py-8 text-center text-red-500">Please log in.</div>;
  const atLimit = prescriptions.length >= MAX_PRESCRIPTIONS;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight text-gray-900">My Prescriptions</h1><p className="mt-1 text-sm text-gray-600">Your private prescription library for the AI assistant.</p></div>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">{prescriptions.length} / {MAX_PRESCRIPTIONS} stored</span>
      </div>

      {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-medium ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{notice.message}</div>}

      <div className="grid gap-7 xl:grid-cols-[22rem_1fr]">
        <section className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><UploadCloud className="h-5 w-5" /></span><div><h2 className="font-bold text-gray-900">Add a prescription</h2><p className="text-xs text-gray-500">JPEG, PNG, WebP or PDF · max 4 MB</p></div></div>
          <form onSubmit={handleUpload} className="mt-5 space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label><input type="text" name="title" required minLength={2} maxLength={80} disabled={atLimit || uploading} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100" placeholder="e.g. Dermatologist prescription" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-gray-700">Document</label><button type="button" disabled={atLimit || uploading} onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-gray-300 p-5 text-center transition hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:bg-gray-50"><UploadCloud className="mx-auto h-7 w-7 text-gray-400" /><span className="mt-2 block truncate text-sm font-semibold text-blue-700">{selectedName || "Choose a file"}</span></button><input ref={fileInputRef} type="file" name="file" className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setSelectedName(event.target.files?.[0]?.name || "")} /></div>
            <button type="submit" disabled={atLimit || uploading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-gray-300">{uploading && <Loader2 className="h-4 w-4 animate-spin" />}{atLimit ? "15 prescription limit reached" : uploading ? "Uploading securely…" : "Upload prescription"}</button>
          </form>
          <p className="mt-4 flex gap-2 text-xs leading-5 text-gray-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Files are stored as authenticated Cloudinary assets and are served only after checking your signed-in account.</p>
        </section>

        <section>
          {loading ? <div className="grid min-h-44 place-items-center rounded-2xl border border-gray-200 bg-white text-sm text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : prescriptions.length === 0 ? <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center"><div><FileText className="mx-auto h-11 w-11 text-gray-300" /><h2 className="mt-3 font-semibold text-gray-900">No prescriptions uploaded</h2><p className="mt-1 text-sm text-gray-500">Add one here, then select it directly inside the AI assistant.</p></div></div> : <ul className="grid gap-4 sm:grid-cols-2">{prescriptions.map((item) => <li key={item._id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="relative grid h-40 place-items-center bg-gray-100">{item.available ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" /> : <div className="px-5 text-center"><FileText className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-2 text-xs font-medium text-amber-700">Legacy file — delete and upload it again</p></div>}<span className="absolute left-3 top-3 rounded-full bg-gray-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{item.mimeType === "application/pdf" ? "PDF preview" : "Image"}</span></div><div className="p-4"><h3 className="truncate font-semibold text-gray-900">{item.title}</h3><p className="mt-1 truncate text-xs text-gray-500">{item.fileName}</p><p className="mt-1 text-xs text-gray-400">Uploaded {new Date(item.createdAt).toLocaleDateString()}</p><div className="mt-4 flex gap-2">{item.available && <a href={item.viewUrl} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"><ExternalLink className="h-4 w-4" /> View</a>}<button type="button" onClick={() => void removePrescription(item)} disabled={deletingId === item._id} className="grid h-10 w-10 place-items-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label={`Delete ${item.title}`}>{deletingId === item._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div></div></li>)}</ul>}
        </section>
      </div>
    </div>
  );
}
