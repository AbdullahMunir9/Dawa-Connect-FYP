import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: { default: 'DawaConnect', template: '%s · DawaConnect' },
  description: 'Order medicines from approved DawaConnect pharmacies, find care nearby, and get answers from the AI health assistant.',
}

import ConditionalChrome from '@/components/ConditionalChrome'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex flex-col bg-gray-50 text-gray-900`}>
        <AuthProvider>
          <CartProvider>
            <ConditionalChrome>{children}</ConditionalChrome>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
