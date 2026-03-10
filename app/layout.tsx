import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'ParkAhead — LA Pre-Arrival Parking Planner',
  description:
    'Find the best metered parking near your LA destination before you leave. Real-time LADOT data, walk-time estimates, and cost forecasts.',
  keywords: ['parking', 'Los Angeles', 'LA parking', 'metered parking', 'LADOT'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-slate-950 text-white antialiased min-h-screen">
        <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-sm select-none">
              P
            </div>
            <span className="font-semibold text-lg tracking-tight">ParkAhead</span>
          </div>
          <span className="text-slate-500 text-sm hidden sm:block">
            LA Pre-Arrival Parking Planner
          </span>
          <div className="ml-auto">
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
              Powered by LADOT Open Data
            </span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
