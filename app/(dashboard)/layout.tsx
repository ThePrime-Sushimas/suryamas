// app/dashboard/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  )
}