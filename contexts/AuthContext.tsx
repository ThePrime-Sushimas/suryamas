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
  hasPermission: (requiredRole: string) => boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock user data for demonstration
const mockUsers: User[] = [
  {
    id: '1',
    username: 'superadmin',
    full_name: 'Super Administrator',
    role: 'super_admin',
    branch_name: 'Head Office',
    email: 'superadmin@restaurant.com'
  },
  {
    id: '2',
    username: 'admin',
    full_name: 'Administrator',
    role: 'admin',
    branch_name: 'Head Office',
    email: 'admin@restaurant.com'
  },
  {
    id: '3',
    username: 'manager',
    full_name: 'Branch Manager',
    role: 'manager',
    branch_id: 'branch-1',
    branch_name: 'Central Branch',
    email: 'manager@restaurant.com'
  },
  {
    id: '4',
    username: 'staff',
    full_name: 'Restaurant Staff',
    role: 'staff',
    branch_id: 'branch-1',
    branch_name: 'Central Branch',
    email: 'staff@restaurant.com'
  },
  {
    id: '5',
    username: 'cashier',
    full_name: 'Cashier',
    role: 'cashier',
    branch_id: 'branch-1',
    branch_name: 'Central Branch',
    email: 'cashier@restaurant.com'
  }
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

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
      // Simple mock authentication for now
      const foundUser = mockUsers.find(u => 
        u.username === credentials.username && 
        credentials.password === 'password'
      )

      if (foundUser) {
        // Load user permissions from database if user exists in DB
        try {
          const permResponse = await fetch(`/api/users/${foundUser.id}/permissions`)
          if (permResponse.ok) {
            const permData = await permResponse.json()
            foundUser.permissions = permData.permissions
          }
        } catch (permError) {
          console.log('Could not load permissions from DB, using mock user')
          // For super_admin, grant all permissions
          if (foundUser.role === 'super_admin') {
            foundUser.permissions = ['MASTER_ACCESS', 'FINANCE_ACCESS', 'SYSTEM_ACCESS', 'VIEW_REPORTS']
          }
        }
        
        const token = `mock-jwt-token-${foundUser.id}-${Date.now()}`
        
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(foundUser))
        
        setUser(foundUser)
        return
      }

      throw new Error('Invalid username or password')
      
    } catch (error) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      throw error
    } finally {
      setLoading(false)
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
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
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