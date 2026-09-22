"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, Truck, CheckCircle2, FileText, XCircle, ArrowRight, Download, RefreshCcw, Info, HelpCircle, ArrowLeftRight, ChevronLeft, ChevronRight, MessageSquareWarning } from "lucide-react";
import { formatPKR } from "@/lib/currency";

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch orders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  if (!user) return <div className="py-8 text-center text-red-500">Please log in.</div>;

  const activeShipments = orders.filter(o => o.status === "Processing" || o.status === "Packed" || o.status === "Dispatched").length;
  const completed = orders.filter(o => o.status === "Delivered").length;
  const cancelled = orders.filter(o => o.status === "Cancelled").length;

  return (
    <div className="flex flex-col gap-8">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Order History</h1>
          <p className="text-sm text-gray-600">Review and manage your clinical supply orders.</p>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-grow lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search Order ID..." className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Active Shipments</p>
          <p className="text-2xl font-bold text-gray-900">{activeShipments}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center text-teal-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Completed</p>
          <p className="text-2xl font-bold text-gray-900">{completed}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-700">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Cancelled Orders</p>
          <p className="text-2xl font-bold text-gray-900">{cancelled}</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-50/50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-6 py-4">Order Details</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map(order => (
                  <tr key={order._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5 align-top">
                      <p className="font-bold text-blue-900 mb-1">#{order.orderId}</p>
                      <p className="text-xs text-gray-500 mb-3">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
                      <p className="text-lg font-bold text-gray-900">{formatPKR(order.total)}</p>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <ul className="text-sm text-gray-600 space-y-1">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-gray-400"></span>{item.name} (x{item.quantity})
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-2 ${
                        order.status === "Delivered" ? "bg-teal-100 text-teal-800" :
                        order.status === "Cancelled" ? "bg-red-100 text-red-800" :
                        "bg-blue-100 text-blue-800"
                      }`}>
                        {order.status === "Delivered" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {order.status === "Cancelled" && <XCircle className="w-3.5 h-3.5" />}
                        {order.status !== "Delivered" && order.status !== "Cancelled" && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                        {order.status}
                      </span>
                      {order.estimatedDelivery && (
                        <p className="text-xs text-gray-500 italic">Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}</p>
                      )}
                    </td>
                    <td className="px-6 py-5 align-top text-right space-y-2">
                      <Link href={`/track/${order.orderId}`} className="inline-flex w-full justify-center items-center gap-2 bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors">
                        <Truck className="w-4 h-4" /> Track
                      </Link>
                      <Link href={`/dashboard/complaints?new=1&orderId=${encodeURIComponent(order.orderId)}${order.fulfillments?.length === 1 ? `&pharmacyId=${encodeURIComponent(order.fulfillments[0].pharmacyId)}` : ""}`} className="inline-flex w-full justify-center items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                        <MessageSquareWarning className="w-4 h-4" /> Report a problem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
