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
  const { user } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show loading spinner during initial mount
  if (!mounted) {
    return <LoadingSpinner fullScreen />
  }

  // Don't show layout for public pages
  const isPublicPage = pathname.startsWith('/auth') || pathname === '/unauthorized' || pathname === '/'

  if (isPublicPage) {
    return (
      <>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </>
    )
  }

  // Layout for protected pages (auth handled by ProtectedLayout)
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
