import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ImageOff, Pencil, Pill, Plus, Trash2, Upload } from "lucide-react";
import { AdminAPI, errorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebounced, useQuery } from "../hooks/useQuery";
import { formatDate } from "../lib/format";
import { PageHeader, Toolbar } from "../components/layout/PageHeader";
import { ConfirmDialog, Modal } from "../components/ui/overlays";
import { Badge, Button, Card, EmptyState, Field, Input, SearchInput, Select, Skeleton } from "../components/ui/primitives";

const CATEGORIES = [
  "Analgesic", "Antibiotic", "Antidiabetic", "Antacid", "Antihistamine", "Anti-inflammatory",
  "Cardiovascular", "Supplement", "Antiviral", "Dermatology", "Respiratory", "Gastrointestinal",
  "Neurology", "Eye & Ear Care", "First Aid", "Personal Care", "Baby Care", "Hygiene", "Other",
];
const UNITS = [
  "Tablets", "Capsules", "Syrup (ml)", "Suspension (ml)", "Injection", "Drops", "Cream (g)",
  "Ointment (g)", "Gel (g)", "Inhaler", "Sachets", "Powder", "Solution (ml)", "Device", "Pack", "Other",
];
const EMPTY_FORM = {
  displayName: "", brandName: "", genericName: "", category: "Other", unit: "Other", strength: "",
  dosageForm: "", packSize: "", manufacturer: "", drapRegistrationNumber: "", aliases: "", status: "active",
  rightsConfirmed: false,
};

const CSV_TEMPLATE = [
  "displayName,brandName,genericName,category,unit,strength,dosageForm,packSize,manufacturer,drapRegistrationNumber,aliases,status",
  '"Panadol 500mg Tablets","Panadol","Paracetamol","Analgesic","Tablets","500 mg","Tablet","20 tablets","GSK","","Acetaminophen, PCM","active"',
].join("\r\n");

function recordForm(record) {
  if (!record) return { ...EMPTY_FORM };
  return {
    displayName: record.displayName || "", brandName: record.brandName || "", genericName: record.genericName || "",
    category: record.category || "Other", unit: record.unit || "Other", strength: record.strength || "",
    dosageForm: record.dosageForm || "", packSize: record.packSize || "", manufacturer: record.manufacturer || "",
    drapRegistrationNumber: record.drapRegistrationNumber || "", aliases: (record.aliases || []).join(", "),
    status: record.status || "active", rightsConfirmed: false,
  };
}

function CatalogEditor({ record, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => recordForm(record));
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : record?.image?.secureUrl || ""),
    [file, record],
  );

  useEffect(() => {
    if (!file || !preview) return undefined;
    return () => URL.revokeObjectURL(preview);
  }, [file, preview]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function save(event) {
    event.preventDefault();
    setFormError("");
    if (!form.displayName.trim() || !form.brandName.trim() || !form.genericName.trim()) {
      setFormError("Brand/display name and generic name are required for catalogue medicines.");
      return;
    }
    if (file && !form.rightsConfirmed) {
      setFormError("Confirm that DawaConnect has permission to use this image before uploading it.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        displayName: form.displayName, brandName: form.brandName, genericName: form.genericName,
        category: form.category, unit: form.unit, strength: form.strength, dosageForm: form.dosageForm,
        packSize: form.packSize, manufacturer: form.manufacturer, drapRegistrationNumber: form.drapRegistrationNumber,
        aliases: form.aliases.split(",").map((value) => value.trim()).filter(Boolean), status: form.status,
      };
      let saved = record
        ? await AdminAPI.updateMedicineCatalog(record.id, payload)
        : await AdminAPI.createMedicineCatalog(payload);
      if (file) {
        saved = await AdminAPI.uploadMedicineCatalogImage(saved.id, file, {
          rightsConfirmed: form.rightsConfirmed,
        });
      }
      toast.success(record ? "Catalogue item updated" : "Catalogue item created", file ? "The shared product image was uploaded too." : "A neutral fallback image will be used until an image is added.");
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(errorMessage(error, "Could not save this catalogue item."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id="catalog-editor" onSubmit={save} className="space-y-5">
      <section>
        <h3 className="text-sm font-semibold text-ink">Core product identity</h3>
        <p className="mt-1 text-xs text-muted">These fields are suggested to pharmacy owners, but they may still add a custom product without using the catalogue.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Display / brand product name" required><Input value={form.displayName} onChange={set("displayName")} placeholder="Panadol 500mg Tablets" maxLength={160} /></Field>
          <Field label="Brand name" required><Input value={form.brandName} onChange={set("brandName")} placeholder="Panadol" maxLength={120} /></Field>
          <Field label="Generic name" required><Input value={form.genericName} onChange={set("genericName")} placeholder="Paracetamol" maxLength={180} /></Field>
          <Field label="Aliases" hint="Separate search terms with commas."><Input value={form.aliases} onChange={set("aliases")} placeholder="Acetaminophen, PCM" /></Field>
          <Field label="Category" required><Select value={form.category} onChange={set("category")}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Unit" required><Select value={form.unit} onChange={set("unit")}>{UNITS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Strength"><Input value={form.strength} onChange={set("strength")} placeholder="500 mg" /></Field>
          <Field label="Dosage form"><Input value={form.dosageForm} onChange={set("dosageForm")} placeholder="Tablet" /></Field>
          <Field label="Pack size"><Input value={form.packSize} onChange={set("packSize")} placeholder="20 tablets" /></Field>
          <Field label="Manufacturer"><Input value={form.manufacturer} onChange={set("manufacturer")} placeholder="Manufacturer name" /></Field>
          <Field label="DRAP registration number"><Input value={form.drapRegistrationNumber} onChange={set("drapRegistrationNumber")} /></Field>
          <Field label="Catalogue status"><Select value={form.status} onChange={set("status")}><option value="active">Active</option><option value="draft">Draft</option><option value="retired">Retired</option></Select></Field>
        </div>
      </section>

      <section className="border-t border-line pt-5">
        <h3 className="text-sm font-semibold text-ink">Shared catalogue image</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr]">
          <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
            {preview ? <img src={preview} alt="Selected catalogue product" className="h-full w-full object-contain" /> : <ImageOff className="h-8 w-8 text-subtle" />}
          </div>
          <div className="space-y-3">
            <Field label="Image file" hint="JPEG, PNG or WebP, maximum 5 MB."><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></Field>
            {file && <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><input type="checkbox" checked={form.rightsConfirmed} onChange={set("rightsConfirmed")} className="mt-0.5" /><span>I confirm that DawaConnect has permission to store and display this exact product image.</span></label>}
          </div>
        </div>
      </section>

      {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{formError}</p>}
      <div className="hidden" aria-hidden="true">{saving ? "Saving" : ""}</div>
    </form>
  );
}

export default function MedicineCatalogPage() {
  const { isSuperadmin } = useAuth();
  const toast = useToast();
  const [query, setQueryValue] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const [removeImageFrom, setRemoveImageFrom] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const csvInputRef = useRef(null);
  const setQuery = (value) => { setQueryValue(value); setPage(1); };
  const debounced = useDebounced(query);
  const { data, loading, error, refetch, updatedAt } = useQuery(
    () => AdminAPI.medicineCatalog({ query: debounced, status, page, limit: 25 }),
    [debounced, status, page],
  );

  const totalPages = Math.max(1, Math.ceil(Number(data?.total || 0) / Number(data?.limit || 25)));
  const rows = data?.items || [];
  const statusTone = { active: "success", draft: "warning", retired: "neutral" };
  const counts = useMemo(() => ({ shown: rows.length, total: Number(data?.total || 0) }), [rows.length, data?.total]);

  async function removeImage() {
    try {
      await AdminAPI.removeMedicineCatalogImage(removeImageFrom.id);
      toast.success("Shared image removed", "Pharmacies without another selected catalogue image will use the neutral fallback.");
      setRemoveImageFrom(null);
      refetch();
    } catch (errorValue) {
      toast.error("Could not remove image", errorMessage(errorValue));
      throw errorValue;
    }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([`\uFEFF${CSV_TEMPLATE}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dawaconnect-medicine-catalog-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function importCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Select a CSV file", "Only .csv catalogue files can be imported.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("CSV file is too large", "The maximum import size is 2 MB (up to 2,000 medicine rows).");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await AdminAPI.importMedicineCatalogCsv(await file.text());
      setImportResult(result);
      if (result.imported > 0) {
        toast.success("Catalogue import complete", `${result.imported} medicine${result.imported === 1 ? "" : "s"} added. ${result.skipped} skipped.`);
      } else {
        toast.error("No medicines were imported", "Review the import summary for duplicate or invalid rows.");
      }
      setPage(1);
      refetch();
    } catch (errorValue) {
      toast.error("Could not import catalogue CSV", errorMessage(errorValue));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Medicine catalogue"
        description="Manage reusable product data and shared images. Pharmacy owners may select these suggestions or add a completely custom medicine or pharmacy product."
        onRefresh={refetch}
        refreshing={loading}
        updatedAt={updatedAt}
        actions={isSuperadmin && <>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
          <Button size="sm" variant="secondary" onClick={downloadCsvTemplate}><Download className="h-4 w-4" /> CSV template</Button>
          <Button size="sm" variant="secondary" disabled={importing} onClick={() => csvInputRef.current?.click()}><Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import CSV"}</Button>
          <Button size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add catalogue item</Button>
        </>}
      />
      {importResult && (
        <Card className="mb-5 border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-950/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">CSV import summary</h2>
              <p className="mt-1 text-sm text-muted">{importResult.imported} of {importResult.totalRows} medicines added; {importResult.skipped} skipped. Imported medicines intentionally have no image until one is added from Edit.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setImportResult(null)}>Dismiss</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="success">{importResult.imported} imported</Badge>
            <Badge tone="neutral">{importResult.duplicateCount} duplicates</Badge>
            <Badge tone={importResult.invalidCount ? "danger" : "neutral"}>{importResult.invalidCount} invalid</Badge>
            <Badge tone="warning">{importResult.missingImages} missing images</Badge>
          </div>
          {importResult.errors?.length > 0 && (
            <details className="mt-3 rounded-lg border border-line bg-surface p-3 text-xs text-muted">
              <summary className="cursor-pointer font-medium text-ink">Review skipped rows</summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {importResult.errors.map((item, index) => <li key={`${item.row || "batch"}-${index}`}>{item.row ? `Row ${item.row}: ` : ""}{item.message}</li>)}
              </ul>
              {importResult.errorsTruncated && <p className="mt-2">Only the first 100 issues are shown.</p>}
            </details>
          )}
        </Card>
      )}
      <Card padded={false}>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search brand, generic, manufacturer…" className="w-full sm:w-80" />
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="w-full sm:w-40"><option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="retired">Retired</option></Select>
          <span className="ml-auto text-xs text-muted">{counts.total.toLocaleString()} catalogue items</span>
        </Toolbar>

        {loading && !data && <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-48 rounded-xl" />)}</div>}
        {error && !data && <EmptyState title="Could not load the medicine catalogue" description={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}
        {data && !rows.length && <EmptyState icon={Pill} title="No catalogue items found" description={query || status ? "Change the filters or add a new catalogue item." : "Add the first verified product and its shared image."} action={isSuperadmin && <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add item</Button>} />}
        {rows.length > 0 && (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((item) => (
              <article key={item.id} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4">
                <div className="flex gap-3">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2">
                    {item.image?.secureUrl ? <img src={item.image.secureUrl} alt={item.image.alt || item.displayName} className="h-full w-full object-contain" /> : <ImageOff className="h-6 w-6 text-subtle" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="line-clamp-2 font-semibold text-ink">{item.displayName}</h3>{!item.image?.secureUrl && <Badge tone="warning" className="mt-1"><ImageOff className="h-3 w-3" /> Missing image</Badge>}</div><Badge tone={statusTone[item.status] || "neutral"}>{item.status}</Badge></div>
                    <p className="mt-1 truncate text-sm text-muted">{item.genericName || "Generic name not set"}</p>
                    <p className="mt-1 text-xs text-subtle">{[item.strength, item.dosageForm, item.packSize].filter(Boolean).join(" · ") || "No formulation details"}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-subtle">Category</dt><dd className="mt-0.5 truncate text-ink-2">{item.category}</dd></div>
                  <div><dt className="text-subtle">Unit</dt><dd className="mt-0.5 truncate text-ink-2">{item.unit}</dd></div>
                  <div><dt className="text-subtle">Brand</dt><dd className="mt-0.5 truncate text-ink-2">{item.brandName || "—"}</dd></div>
                  <div><dt className="text-subtle">Updated</dt><dd className="mt-0.5 truncate text-ink-2">{item.updatedAt ? formatDate(item.updatedAt) : "—"}</dd></div>
                </dl>
                {isSuperadmin && <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3"><Button size="sm" variant="secondary" onClick={() => setEditing(item)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>{item.image?.secureUrl && <Button size="sm" variant="dangerOutline" onClick={() => setRemoveImageFrom(item)}><Trash2 className="h-3.5 w-3.5" /> Remove image</Button>}</div>}
              </article>
            ))}
          </div>
        )}
        {data && data.total > data.limit && <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted"><span>Page {data.page} of {totalPages}</span><div className="flex gap-1"><Button size="iconSm" variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button><Button size="iconSm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button></div></div>}
      </Card>

      {isSuperadmin && <Card className="mt-5">
        <div className="flex gap-3"><Upload className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /><div><h3 className="text-sm font-semibold text-ink">Bulk catalogue import</h3><p className="mt-1 text-sm leading-6 text-muted">Download the CSV template, keep the five required columns filled (displayName, brandName, genericName, category and unit), then import up to 2,000 rows at once. Use an exact category and unit from the catalogue form, or use Other. Images are intentionally not accepted in CSV files; add them later by editing each medicine marked <span className="font-medium text-amber-700 dark:text-amber-300">Missing image</span>.</p></div></div>
      </Card>}

      <Card className="mt-5">
        <div className="flex gap-3"><Upload className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /><div><h3 className="text-sm font-semibold text-ink">How pharmacies use this catalogue</h3><p className="mt-1 text-sm leading-6 text-muted">A pharmacy may select a catalogue suggestion to auto-fill product details, select only a shared image, or ignore the catalogue and create a custom item such as Pampers. Missing catalogue data and image requests are submitted from the Pharmacy Complaints page.</p></div></div>
      </Card>

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? "Edit catalogue item" : "Add catalogue item"}
        description="One verified record and image can be reused by every pharmacy."
        size="xl"
        footer={<><Button variant="secondary" onClick={() => setEditing(undefined)}>Cancel</Button><Button type="submit" form="catalog-editor">{editing ? "Save changes" : "Create item"}</Button></>}
      >
        {editing !== undefined && <CatalogEditor record={editing} onClose={() => setEditing(undefined)} onSaved={() => refetch()} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(removeImageFrom)}
        onClose={() => setRemoveImageFrom(null)}
        onConfirm={removeImage}
        title="Remove this shared image?"
        description="The catalogue metadata remains active. Products using no other image will display the neutral DawaConnect fallback."
        confirmLabel="Remove image"
      />
    </>
  );
}
