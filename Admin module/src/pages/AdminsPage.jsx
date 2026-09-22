import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, ShieldAlert, Trash2, CheckCircle2, UserPlus, Copy } from "lucide-react";
import { AdminAPI, errorMessage } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useBadges } from "../context/BadgesContext";
import { formatDateTime, formatRelative } from "../lib/format";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable } from "../components/ui/DataTable";
import { ConfirmDialog } from "../components/ui/overlays";
import { Avatar, Badge, Button, Card, CardHeader, StatusBadge } from "../components/ui/primitives";

export default function AdminsPage() {
  const { admin: me, isSuperadmin } = useAuth();
  const toast = useToast();
  const { refresh } = useBadges();
  const { data, loading, error, refetch, updatedAt, setData } = useQuery(() => AdminAPI.admins(), [], { enabled: isSuperadmin });
  const [toDelete, setToDelete] = useState(null);
  const pending = useMemo(() => (data || []).filter((a) => a.status === "pending"), [data]);
  if (!isSuperadmin) return <Navigate to="/" replace />;

  async function approve(admin) {
    try {
      const updated = await AdminAPI.approveAdmin(admin.id);
      setData((list) => list.map((a) => (a.id === admin.id ? { ...a, ...updated, id: admin.id } : a)));
      toast.success("Admin approved", `${admin.name} can sign in now.`);
      refresh();
    } catch (err) { toast.error("Could not approve", errorMessage(err)); }
  }

  async function remove() {
    await AdminAPI.deleteAdmin(toDelete.id);
    setData((list) => list.filter((a) => a.id !== toDelete.id));
    toast.success("Admin removed", `${toDelete.name} no longer has access.`);
    refresh();
  }

  const registerUrl = `${window.location.origin}/register`;
  const columns = [
    { id: "name", header: "Admin", sortable: true, accessor: (r) => r.name, cell: (r) => <div className="flex items-center gap-3"><Avatar name={r.name} size="sm" /><div className="min-w-0"><p className="truncate font-medium text-ink">{r.name}{r.id === me?.id && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</p><p className="truncate text-xs text-muted">{r.email}</p></div></div> },
    { id: "role", header: "Role", sortable: true, accessor: (r) => r.role, cell: (r) => <Badge tone={r.role === "superadmin" ? "violet" : "neutral"}>{r.role === "superadmin" ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}{r.role === "superadmin" ? "Super admin" : "Admin"}</Badge> },
    { id: "status", header: "Status", sortable: true, accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: "created", header: "Registered", sortable: true, accessor: (r) => new Date(r.createdAt), hideBelow: "md", cell: (r) => <span className="text-muted" title={formatDateTime(r.createdAt)}>{formatRelative(r.createdAt)}</span> },
    { id: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1.5">
        {r.status === "pending" && <Button size="sm" variant="success" onClick={() => approve(r)}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>}
        {r.role !== "superadmin" && r.id !== me?.id && <Button size="sm" variant="dangerOutline" onClick={() => setToDelete(r)} aria-label={`Remove ${r.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>}
      </div>) },
  ];

  return (
    <>
      <PageHeader title="Admins" description="Manage who can access this console. New sign-ups wait here until you approve them." onRefresh={refetch} refreshing={loading} updatedAt={updatedAt} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader className="px-5 pt-5" title="Admin accounts" description={pending.length ? `${pending.length} waiting for approval` : "Everyone listed here is approved."} />
          <div className="mt-3">
            <DataTable columns={columns} rows={data || []} rowKey="id" loading={loading} error={error} defaultSort={{ id: "status", dir: "desc" }} emptyIcon={ShieldCheck} emptyTitle="No admins found" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Invite an admin" description="Send a colleague the registration link. Their account stays pending until you approve it here." />
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs"><UserPlus className="h-4 w-4 shrink-0 text-muted" /><span className="truncate font-mono text-ink-2">{registerUrl}</span></div>
          <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => { navigator.clipboard?.writeText(registerUrl).then(() => toast.success("Link copied")); }}><Copy className="h-3.5 w-3.5" /> Copy registration link</Button>
          <ul className="mt-5 space-y-2 text-xs text-muted">
            <li>• Super admins can approve and remove admins; admins can do everything else.</li>
            <li>• Super admin accounts cannot be deleted from the console.</li>
            <li>• Every approval and removal is written to the audit log.</li>
          </ul>
        </Card>
      </div>

      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} tone="danger" confirmLabel="Remove admin" title={`Remove ${toDelete?.name}?`} description="They will be signed out immediately and will not be able to sign in again unless they re-register and are approved." onConfirm={remove} />
    </>
  );
}
