import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-2">DawaConnect</h2>
            <p className="text-sm text-gray-500 mb-2 max-w-md">
              © 2024 DawaConnect. Professional Healthcare Marketplace. Connecting patients with verified medical providers and pharmacies globally.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Platform</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Pharmacy Support
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Medical Disclaimer
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </footer>
  );
}
