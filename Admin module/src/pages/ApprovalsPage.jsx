import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, ClipboardCheck, MapPin, Phone, Mail, FileBadge, Clock3, Eye, CheckCircle2, XCircle, Ban } from "lucide-react";
import { AdminAPI } from "../lib/api";
import { useQuery, useDebounced } from "../hooks/useQuery";
import { cn, formatDate, formatRelative } from "../lib/format";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge, Button, Card, CardHeader, EmptyState, SearchInput, Segmented, Skeleton } from "../components/ui/primitives";
import { PharmacyDrawer, PharmacyActionButtons, usePharmacyActions } from "../features/PharmacyDrawer";

function ApprovalCard({ pharmacy, actions, onOpen }) {
  const address = [pharmacy.addressLine1, pharmacy.area, pharmacy.city, pharmacy.province].filter(Boolean).join(", ");
  const missing = [!pharmacy.license && "licence", !pharmacy.cnic && "CNIC", (pharmacy.latitude == null || pharmacy.longitude == null) && "map location", !pharmacy.phone && "phone"].filter(Boolean);
  const accent = { pending: "border-amber-200 dark:border-amber-900/50", rejected: "border-red-200 dark:border-red-900/50", suspended: "border-red-200 dark:border-red-900/50" }[pharmacy.state];
  return (
    <article className={cn("flex flex-col rounded-2xl border bg-surface p-4 shadow-card transition hover:shadow-md", accent)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 dark:bg-brand-950/60"><Building2 className="h-5 w-5 text-brand-600" /></span>
          <div className="min-w-0"><h3 className="truncate font-semibold text-ink">{pharmacy.name}</h3><p className="truncate text-xs text-muted">{pharmacy.ownerName || "Owner not provided"}</p></div>
        </div>
        <span className="shrink-0 text-[11px] text-subtle" title={formatDate(pharmacy.createdAt)}><Clock3 className="mr-1 inline h-3 w-3" />{formatRelative(pharmacy.createdAt)}</span>
      </div>
      <dl className="mt-4 space-y-1.5 text-[13px]">
        <div className="flex gap-2 text-ink-2"><FileBadge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" /><span className="font-mono text-xs">{pharmacy.license || <span className="text-red-600">Licence missing</span>}</span></div>
        <div className="flex gap-2 text-ink-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" /><span className="line-clamp-2">{address || "Address not provided"}</span></div>
        <div className="flex gap-2 text-ink-2"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" /><span>{pharmacy.phone || "—"}</span></div>
        <div className="flex gap-2 text-ink-2"><Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" /><span className="truncate">{pharmacy.email || "—"}</span></div>
      </dl>
      {pharmacy.state === "pending" && missing.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Missing: {missing.join(", ")}</p>}
      {pharmacy.state === "rejected" && pharmacy.rejectionReason && <p className="mt-3 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200"><span className="font-semibold">Rejected:</span> {pharmacy.rejectionReason}</p>}
      {pharmacy.state === "suspended" && <p className="mt-3 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200"><span className="font-semibold">Suspended:</span> {pharmacy.suspensionReason || "no reason recorded"}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <Button variant="ghost" size="sm" onClick={() => onOpen(pharmacy.id)}><Eye className="h-3.5 w-3.5" /> Review details</Button>
        <PharmacyActionButtons pharmacy={pharmacy} actions={actions} compact />
      </div>
    </article>
  );
}

export default function ApprovalsPage() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refetch, updatedAt, setData } = useQuery(() => AdminAPI.pharmacies(), [], { pollMs: 20000 });
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query);
  const selectedId = params.get("id");
  const actions = usePharmacyActions({ onDone: (updated) => setData((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))) });

  const groups = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    const match = (p) => !needle || `${p.name} ${p.ownerName || ""} ${p.city || ""} ${p.license || ""} ${p.email || ""}`.toLowerCase().includes(needle);
    const list = (data || []).filter(match);
    return { pending: list.filter((p) => p.state === "pending"), rejected: list.filter((p) => p.state === "rejected"), suspended: list.filter((p) => p.state === "suspended") };
  }, [data, debounced]);
  const shown = groups[tab] || [];

  function openDrawer(id) { const next = new URLSearchParams(params); if (id) next.set("id", id); else next.delete("id"); setParams(next); }

  return (
    <>
      <PageHeader title="Approvals" description="Review new pharmacy registrations. Approving makes their inventory visible on the Marketplace; rejecting tells them why." onRefresh={refetch} refreshing={loading} updatedAt={updatedAt} />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Segmented value={tab} onChange={setTab} options={[
            { value: "pending", label: "Awaiting review", icon: ClipboardCheck, count: groups.pending.length },
            { value: "rejected", label: "Rejected", icon: XCircle, count: groups.rejected.length },
            { value: "suspended", label: "Suspended", icon: Ban, count: groups.suspended.length },
          ]} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search…" className="ml-auto w-full sm:w-64" />
        </div>
        <div className="p-4">
          {loading && !data && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>}
          {error && !data && <EmptyState title="Couldn’t load pharmacies" description={error} action={<Button onClick={() => refetch()}>Retry</Button>} />}
          {data && shown.length === 0 && (
            <EmptyState icon={tab === "pending" ? CheckCircle2 : Building2}
              title={tab === "pending" ? (debounced ? "No pending pharmacies match" : "You’re all caught up") : `No ${tab} pharmacies`}
              description={tab === "pending" && !debounced ? "New registrations from the pharmacy desktop app will appear here automatically." : "Nothing to show for this filter."} />
          )}
          {shown.length > 0 && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((p) => <ApprovalCard key={p.id} pharmacy={p} actions={actions} onOpen={openDrawer} />)}</div>}
        </div>
      </Card>

      {data && (
        <Card className="mt-5">
          <CardHeader title="How approval affects the platform" />
          <ul className="mt-3 grid gap-3 text-sm text-ink-2 sm:grid-cols-3">
            <li className="rounded-xl bg-surface-2 p-3"><Badge tone="success" className="mb-2">Approve</Badge><p>Sets <span className="font-mono text-xs">status=approved, approvalStatus=approved</span>. Inventory becomes purchasable on the Marketplace and the pharmacy app unlocks orders.</p></li>
            <li className="rounded-xl bg-surface-2 p-3"><Badge tone="danger" className="mb-2">Reject</Badge><p>Keeps the account but shows your reason inside the pharmacy app. They can fix the issue and ask to be re-reviewed; you can approve later.</p></li>
            <li className="rounded-xl bg-surface-2 p-3"><Badge tone="warning" className="mb-2">Suspend</Badge><p>Hides an approved pharmacy from the Marketplace and blocks its workspaces. Existing orders are untouched. Reinstate at any time.</p></li>
          </ul>
        </Card>
      )}

      <PharmacyDrawer pharmacyId={selectedId} onClose={() => openDrawer(null)} onChanged={() => refetch({ silent: true })} />
      {actions.dialogs}
    </>
  );
}
