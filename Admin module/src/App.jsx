import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { LoaderCircle, Compass } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { BadgesProvider } from "./context/BadgesContext";
import AppShell from "./components/layout/AppShell";
import { Button, EmptyState } from "./components/ui/primitives";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import PharmaciesPage from "./pages/PharmaciesPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import OrdersPage from "./pages/OrdersPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import AuditLogPage from "./pages/AuditLogPage";
import AdminsPage from "./pages/AdminsPage";

function SplashScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3 text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-brand-600" /><p className="text-sm">Restoring your session…</p></div>
    </div>
  );
}

function RequireAuth() {
  const { admin, checking } = useAuth();
  const location = useLocation();
  if (checking) return <SplashScreen />;
  if (!admin) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return (
    <BadgesProvider>
      <Outlet />
    </BadgesProvider>
  );
}

function NotFound() {
  return <EmptyState icon={Compass} title="Page not found" description="The page you’re looking for doesn’t exist in the admin console." action={<Button onClick={() => window.history.back()}>Go back</Button>} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="complaints" element={<ComplaintsPage />} />
                  <Route path="pharmacies" element={<PharmaciesPage />} />
                  <Route path="approvals" element={<ApprovalsPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="admins" element={<AdminsPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
