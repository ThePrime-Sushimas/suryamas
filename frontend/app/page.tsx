'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  const supabase = createClient()

  useEffect(() => {
    // Check current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Get profile from backend
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          try {
            const response = await fetch('http://localhost:3001/api/auth/profile', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            })
            if (response.ok) {
              const profileData = await response.json()
              setProfile(profileData)
            }
          } catch (error) {
            console.error('Failed to fetch profile:', error)
          }
        }
      }
    }
    
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      if (isRegister) {
        // Register via backend (creates both Supabase user and profile)
        const response = await fetch('http://localhost:3001/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName })
        })
        
        const data = await response.json()
        
        if (response.ok) {
          setMessage(`✅ Registration successful! Please login with your credentials.`)
          setIsRegister(false)
          setEmail('')
          setPassword('')
          setFullName('')
        } else {
          setMessage(`❌ ${data.error}`)
        }
      } else {
        // Login via Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) {
          setMessage(`❌ ${error.message}`)
        } else {
          setMessage(`✅ Login successful! Welcome back.`)
          setEmail('')
          setPassword('')
        }
      }
    } catch (error) {
      setMessage('❌ Network error')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMessage('👋 Logged out successfully')
  }

  // If user is logged in, show dashboard
  if (user) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-800">
                🏢 SURYAMAS Dashboard
              </h1>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">User Info</h2>
              <div className="space-y-2">
                <p><strong>ID:</strong> {user.id}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Created:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">Profile</h2>
              {profile ? (
                <div className="space-y-2">
                  <p><strong>Full Name:</strong> {profile.full_name || 'Not set'}</p>
                  <p><strong>Phone:</strong> {profile.phone || 'Not set'}</p>
                  <p><strong>Updated:</strong> {new Date(profile.updated_at).toLocaleDateString()}</p>
                </div>
              ) : (
                <p className="text-gray-500">Loading profile...</p>
              )}
            </div>
          </div>

          <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700">
                💰 Petty Cash
              </button>
              <button className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700">
                📋 Purchase Order
              </button>
              <button className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700">
                ✅ Approvals
              </button>
              <button className="bg-orange-600 text-white p-4 rounded-lg hover:bg-orange-700">
                📊 Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Login/Register form
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          🏢 SURYAMAS
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            {isRegister ? 'Register' : 'Login'}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-blue-600 hover:underline"
          >
            {isRegister ? 'Already have account? Login' : 'Need account? Register'}
          </button>
        </div>
        
        {message && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
