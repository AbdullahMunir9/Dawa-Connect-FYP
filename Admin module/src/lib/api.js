import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const TOKEN_KEY = "dc-admin-token";
const ADMIN_KEY = "dc-admin-user";

export const session = {
  get token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } },
  get admin() { try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || "null"); } catch { return null; } },
  save(token, admin) {
    try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(ADMIN_KEY, JSON.stringify(admin)); } catch { /* storage unavailable */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ADMIN_KEY); } catch { /* storage unavailable */ }
  },
};

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = session.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 anywhere means the session is gone; the AuthProvider listens for this event.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/admin/login")) {
      session.clear();
      window.dispatchEvent(new CustomEvent("dc-admin:unauthorized", { detail: error.response?.data?.message }));
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (error.code === "ERR_NETWORK") return "Cannot reach the admin API. Is the server running on port 5000?";
  return error.response?.data?.message || error.response?.data?.error || error.message || fallback;
}

/* Typed helpers – one place to change an endpoint. */
export const AdminAPI = {
  login: (email, password) => api.post("/admin/login", { email, password }).then((r) => r.data),
  signup: (payload) => api.post("/admin/signup", payload).then((r) => r.data),
  me: () => api.get("/admin/me").then((r) => r.data.admin),
  admins: () => api.get("/admin/all-admins").then((r) => r.data),
  approveAdmin: (id) => api.put(`/admin/approve/${id}`).then((r) => r.data),
  deleteAdmin: (id) => api.delete(`/admin/delete/${id}`).then((r) => r.data),

  dashboard: () => api.get("/users/dashboard").then((r) => r.data),
  badges: () => api.get("/users/badges").then((r) => r.data),

  customers: () => api.get("/users/all-users").then((r) => r.data),
  customer360: (id) => api.get(`/users/customer-360/${id}`).then((r) => r.data),
  setCustomerStatus: (id, status, reason) => api.patch(`/users/toggle-status/${id}`, { status, reason }).then((r) => r.data),
  deleteCustomer: (id, reason) => api.delete(`/users/${id}`, { data: { reason } }).then((r) => r.data),

  pharmacies: () => api.get("/users/pharmacies").then((r) => r.data),
  pharmacy360: (id) => api.get(`/users/pharmacy-360/${id}`).then((r) => r.data),
  pharmacyProducts: (id) => api.get(`/users/pharmacy-products/${id}`).then((r) => r.data),
  approvePharmacy: (id) => api.patch(`/users/approve-pharmacy/${id}`).then((r) => r.data),
  rejectPharmacy: (id, reason) => api.patch(`/users/reject-pharmacy/${id}`, { reason }).then((r) => r.data),
  setPharmacyStatus: (id, status, reason) => api.patch(`/users/pharmacy-status/${id}`, { status, reason }).then((r) => r.data),

  orders: (limit) => api.get("/users/all-orders", { params: { limit } }).then((r) => r.data),
  order: (id) => api.get(`/users/order/${id}`).then((r) => r.data),

  complaints: (params) => api.get("/complaints", { params }).then((r) => r.data),
  complaint: (id) => api.get(`/complaints/${id}`).then((r) => r.data.complaint),
  replyComplaint: (id, text) => api.post(`/complaints/${id}/reply`, { text }).then((r) => r.data.complaint),
  updateComplaint: (id, payload) => api.patch(`/complaints/${id}`, payload).then((r) => r.data.complaint),

  audit: (params) => api.get("/audit", { params }).then((r) => r.data),
  health: () => api.get("/health").then((r) => r.data),
};
