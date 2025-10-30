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
        // Check both localStorage and sessionStorage for backup
        const token = localStorage.getItem('token') || sessionStorage.getItem('token')
        const userData = localStorage.getItem('user') || sessionStorage.getItem('user')
        
        if (token && userData) {
          const userObj = JSON.parse(userData)
          console.log('Found user in storage:', userObj)
          setUser(userObj)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('user')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (credentials: { username: string; password: string }) => {
    try {
      setLoading(true)
      console.log('Login attempt:', credentials)

      // Try database login first
      try {
        const response = await fetch('/api/users?search=' + credentials.username + '&limit=100')
        if (response.ok) {
          const data = await response.json()
          const dbUser = data.users?.find((u: any) => u.username === credentials.username)
          
          if (dbUser && dbUser.is_active) {
            // Get user with password_hash from database directly
            const { data: userData, error } = await (await import('@/lib/supabaseClient')).supabase
              .from('users')
              .select(`
                *,
                role:roles(role_name, role_code),
                employee:employees(full_name),
                branch:branches(nama_branch)
              `)
              .eq('username', credentials.username)
              .eq('is_active', true)
              .single()

            if (!error && userData) {
              // Decode password hash and verify
              const storedPassword = Buffer.from(userData.password_hash || '', 'base64').toString()
              
              if (storedPassword === credentials.password) {
                const userObj = {
                  id: userData.id.toString(),
                  username: userData.username,
                  full_name: userData.employee?.full_name || userData.username,
                  role: userData.role?.role_code?.toLowerCase() || 'staff',
                  branch_name: userData.branch?.nama_branch || '',
                  email: userData.email
                }
                
                const token = `jwt-token-${userData.id}-${Date.now()}`
                
                localStorage.setItem('token', token)
                localStorage.setItem('user', JSON.stringify(userObj))
                sessionStorage.setItem('token', token)
                sessionStorage.setItem('user', JSON.stringify(userObj))
                
                setUser(userObj)
                console.log('Database login successful:', userObj)
                return
              }
            }
          }
        }
      } catch (apiError) {
        console.log('API login failed, trying mock users:', apiError)
      }

      // Fallback to mock authentication
      const foundUser = mockUsers.find(u => 
        u.username === credentials.username && 
        credentials.password === 'password'
      )

      if (foundUser) {
        console.log('Mock user found:', foundUser)
        
        const token = `mock-jwt-token-${foundUser.id}-${Date.now()}`
        
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(foundUser))
        sessionStorage.setItem('token', token)
        sessionStorage.setItem('user', JSON.stringify(foundUser))
        
        setUser(foundUser)
        console.log('Mock login successful:', foundUser)
        return
      }

      console.log('User not found or invalid password')
      throw new Error('Invalid username or password')
      
    } catch (error) {
      console.error('Login error:', error)
      // Clear any partial auth data
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      setUser(null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    console.log('Logging out...')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  const hasPermission = (requiredRole: string) => {
    if (!user) return false
    
    const roleHierarchy: Record<string, number> = {
      'super_admin': 5,
      'admin': 4,
      'manager': 3,
      'staff': 2,
      'cashier': 1
    }
    
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
  }

  // Debug: log auth state changes
  useEffect(() => {
    console.log('Auth state updated - User:', user, 'Loading:', loading)
  }, [user, loading])

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