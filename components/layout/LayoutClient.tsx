// components/layout/LayoutClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/layout/LoadingSpinner'
import ErrorBoundary from '@/components/layout/ErrorBoundary'

interface LayoutClientProps {
  children: React.ReactNode
}

export default function LayoutClient({ children }: LayoutClientProps) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  console.log('LayoutClient - User:', user, 'Loading:', loading, 'Pathname:', pathname)

  // Show loading spinner while checking auth or during initial mount
  if (!mounted || loading) {
    return <LoadingSpinner fullScreen />
  }

  // Don't show layout for login page
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return (
      <>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </>
    )
  }

  // If no user but not on login page, show loading while redirect happens
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        userRole={user?.role}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        
        {/* Footer */}
        <Footer />
      </div>
      
    </div>
  )
}
