import {
  Package,
  ShoppingCart,
  BarChart3,
  Bell,
  Truck,
} from "lucide-react";

const features = [
  { icon: Package, label: "Browse trusted medicine sellers" },
  { icon: ShoppingCart, label: "Compare prices across stores" },
  { icon: BarChart3, label: "Discover top-rated products quickly" },
  { icon: Bell, label: "Get smart deal and stock alerts" },
  { icon: Truck, label: "Track orders from checkout to delivery" },
];

export default function AuthSplitLayout({ heading, subheading, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <aside
        className="relative flex w-full shrink-0 flex-col justify-center overflow-hidden px-8 py-12 sm:px-12 lg:w-1/2 lg:min-h-screen lg:px-14 xl:px-20"
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 0% 0%, #0f766e 0%, #0d4f4a 38%, #022c26 72%, #011a17 100%)",
        }}
      >
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-teal-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-emerald-950/60 blur-3xl" />

        <div className="relative mx-auto max-w-md lg:mx-0">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black/35 shadow-lg ring-1 ring-white/15">
              <div
                className="h-[1.875rem] w-9 shrink-0 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #e53935 0%, #e53935 50%, #fbc02d 50%, #fbc02d 100%)",
                  boxShadow: "inset 0 2px 4px rgb(255 255 255 / 0.15)",
                }}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                DawaConnect
              </h1>
              <p className="text-sm font-medium text-white/80">
                Healthcare Marketplace
              </p>
            </div>
          </div>

          <p className="mt-8 text-[15px] leading-relaxed text-white/92 sm:text-base">
            Pakistan&apos;s trusted healthcare marketplace for medicines and wellness
            products. Shop confidently from verified sellers with fast delivery.
          </p>

          <ul className="mt-10 space-y-4">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/22 text-white shadow-inner ring-1 ring-white/10">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
                </span>
                <span className="pt-[9px] text-sm leading-snug text-white/95">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:w-1/2 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <h2 className="text-[1.65rem] font-bold tracking-tight text-gray-900 sm:text-3xl">
            {heading}
          </h2>
          <p className="mt-2 text-base text-gray-500">{subheading}</p>
          <div className="mt-9">{children}</div>
        </div>
      </div>
    </div>
  );
}
