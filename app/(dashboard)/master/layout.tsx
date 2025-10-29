// app/master/layout.tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface MasterLayoutProps {
  children: React.ReactNode
}

export default function MasterLayout({ children }: MasterLayoutProps) {
  const { user, hasPermission } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Check if user has permission to access master data
    if (user && !hasPermission('manager')) {
      router.push('/unauthorized')
    }
  }, [user, hasPermission, router])

  if (!user) {
    return null
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  )
}