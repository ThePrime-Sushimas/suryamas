import { useMemo } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { BarChart3, Calculator, Users, Wallet } from 'lucide-react'
import { usePermissionStore } from '@/features/branch_context'

const tabs = [
  { id: 'sales', label: 'Sales', path: '/dashboard/sales', icon: BarChart3, module: 'dashboard_sales' },
  { id: 'accounting', label: 'Accounting', path: '/dashboard/accounting', icon: Calculator, module: 'dashboard_accounting' },
  { id: 'hrd', label: 'HRD', path: '/dashboard/hrd', icon: Users, module: 'dashboard_hrd' },
  { id: 'finance', label: 'Finance', path: '/dashboard/finance', icon: Wallet, module: 'dashboard_finance' },
] as const

export default function DashboardLayout() {
  const { permissions, isLoaded } = usePermissionStore()
  const location = useLocation()

  const visibleTabs = useMemo(() => {
    if (!isLoaded) return tabs
    return tabs.filter(t => permissions[t.module]?.view !== false)
  }, [permissions, isLoaded])

  // Redirect /dashboard to first visible tab
  if (location.pathname === '/dashboard') {
    const first = visibleTabs[0]
    return <Navigate to={first?.path ?? '/dashboard/sales'} replace />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Tab navigation */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 w-fit">
          {visibleTabs.map(tab => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </NavLink>
          ))}
        </div>

        <Outlet />
      </div>
    </div>
  )
}
