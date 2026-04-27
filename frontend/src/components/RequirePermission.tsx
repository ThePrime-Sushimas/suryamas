import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { usePermissionStore } from '@/features/branch_context'

interface Props {
  module?: string
  children: React.ReactNode
}

export function RequirePermission({ module, children }: Props) {
  const { token, isInitialized } = useAuthStore()
  const { permissions, isLoaded } = usePermissionStore()

  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!token) return <Navigate to="/login" />

  // No module specified = auth-only (e.g. profile page)
  if (!module) return <>{children}</>

  // Wait for permissions to load
  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!permissions[module]?.view) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Akses Ditolak</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    )
  }

  return <>{children}</>
}
