// components/auth/AuthGuard.tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { usePathname } from 'next/navigation'
import LoadingSpinner from '@/components/layout/LoadingSpinner'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: string;
  requiredPermission?: string;
}

export default function AuthGuard({ children, requiredRole, requiredPermission }: AuthGuardProps) {
  const { user, loading, hasPermission } = useAuth()
  const pathname = usePathname()

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  // If no user is logged in, the useEffect in AuthContext will redirect to login
  if (!user) {
    return null
  }

  // Check permission or role-based access
  const accessDenied = (requiredPermission && !hasPermission(requiredPermission)) || 
                      (requiredRole && !hasPermission(requiredRole));
  
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-6 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page. 
            Your role: <span className="font-medium capitalize">{user.role}</span>
            {requiredPermission && (
              <><br />Required permission: <span className="font-medium">{requiredPermission}</span></>
            )}
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}