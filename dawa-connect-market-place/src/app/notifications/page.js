import { Bell, Package, FileText, CheckCircle, Info } from "lucide-react";
import Link from "next/link";

export default function NotificationsPage() {
  const notifications = [
    {
      id: 1,
      type: "order",
      title: "Order Dispatched",
      description: "Your order #DC-89241 has been dispatched and is on its way.",
      time: "2 hours ago",
      icon: <Package className="w-5 h-5 text-blue-600" />,
      read: false,
      link: "/track/DC-89241"
    },
    {
      id: 2,
      type: "prescription",
      title: "Prescription Approved",
      description: "Your recently uploaded prescription 'Monthly Insulin' has been reviewed and approved by a pharmacist.",
      time: "Yesterday",
      icon: <CheckCircle className="w-5 h-5 text-teal-600" />,
      read: true,
      link: "/dashboard/prescriptions"
    },
    {
      id: 3,
      type: "system",
      title: "Welcome to DawaConnect!",
      description: "Complete your profile to get personalized medicine recommendations.",
      time: "3 days ago",
      icon: <Info className="w-5 h-5 text-purple-600" />,
      read: true,
      link: "/dashboard/settings"
    },
    {
      id: 4,
      type: "refill",
      title: "Time to Refill",
      description: "It looks like your Blood Pressure medication is running low. Tap to reorder.",
      time: "Last Week",
      icon: <FileText className="w-5 h-5 text-yellow-600" />,
      read: true,
      link: "/"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-700 p-2 rounded-lg">
              <Bell className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          </div>
          <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
            Mark all as read
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <li 
                key={notification.id} 
                className={`transition-colors hover:bg-gray-50 ${!notification.read ? 'bg-blue-50/30' : ''}`}
              >
                <Link href={notification.link} className="flex gap-4 p-5">
                  <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    notification.type === 'order' ? 'bg-blue-100' :
                    notification.type === 'prescription' ? 'bg-teal-100' :
                    notification.type === 'system' ? 'bg-purple-100' : 'bg-yellow-100'
                  }`}>
                    {notification.icon}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className={`text-sm font-bold ${!notification.read ? 'text-gray-900' : 'text-gray-800'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {notification.time}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {notification.description}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="flex-shrink-0 flex items-center self-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block"></span>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
