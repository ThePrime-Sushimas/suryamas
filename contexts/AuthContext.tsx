// contexts/AuthContext.tsx
'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: string
  username: string
  full_name: string
  role: string
  branch_id?: string
  branch_name?: string
  email?: string
  permissions?: string[]
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (credentials: { username: string; password: string }) => Promise<void>
  logout: () => void
  refreshPermissions: () => Promise<void>
  hasPermission: (requiredRole: string) => boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()


  useEffect(() => {
    // Check if user is logged in on mount
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token')
        const userData = localStorage.getItem('user')
        
        if (token && userData) {
          const userObj = JSON.parse(userData)
          setUser(userObj)
        }
      } catch (error) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (credentials: { username: string; password: string }) => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Login failed')
      }

      const { user: foundUser, token } = await response.json()
      
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(foundUser))
      
      setUser(foundUser)
      
    } catch (error) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const refreshPermissions = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const userData = await response.json()
        localStorage.setItem('user', JSON.stringify(userData.user))
        setUser(userData.user)
      }
    } catch (error) {
      console.error('Error refreshing permissions:', error)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    router.push('/auth/login')
  }

  const hasPermission = (requiredPermission: string) => {
    if (!user) return false
    
    // Check for wildcard permission first
    if (user.permissions?.includes('*')) {
      return true
    }
    
    // Check if user has specific permission
    if (user.permissions?.includes(requiredPermission)) {
      return true
    }
    
    // Fallback: allow all permissions for super_admin
    if (user.role === 'super_admin') {
      return true
    }
    
    return false
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshPermissions, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
