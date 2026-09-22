import { LayoutDashboard, Users, Building2, ClipboardCheck, ShoppingBag, MessageSquareWarning, ScrollText, ShieldCheck } from "lucide-react";

export const NAV = [
  { group: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    group: "Operations",
    items: [
      { to: "/orders", label: "Orders", icon: ShoppingBag },
      { to: "/complaints", label: "Complaints", icon: MessageSquareWarning, badge: "openComplaints" },
      { to: "/pharmacies", label: "Pharmacies", icon: Building2 },
      { to: "/approvals", label: "Approvals", icon: ClipboardCheck, badge: "pendingPharmacies" },
    ],
  },
  { group: "People", items: [{ to: "/customers", label: "Customers", icon: Users }] },
  {
    group: "Platform",
    items: [
      { to: "/audit", label: "Audit log", icon: ScrollText },
      { to: "/admins", label: "Admins", icon: ShieldCheck, badge: "pendingAdmins", superadmin: true },
    ],
  },
];

export function pageTitle(pathname) {
  for (const group of NAV) for (const item of group.items) if (item.end ? pathname === item.to : pathname.startsWith(item.to)) return item.label;
  return "DawaConnect";
}
