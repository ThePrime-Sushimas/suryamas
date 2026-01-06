import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { parseApiError } from '@/lib/errorParser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(parseApiError(err, 'Login failed'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-6 md:space-y-8 p-6 md:p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-center">Login</h2>
          <p className="mt-2 text-center text-sm md:text-base text-gray-600">Suryamas Finance Management</p>
        </div>
        <form className="mt-6 md:mt-8 space-y-4 md:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm md:text-base">{error}</div>
          )}
          <div className="space-y-3 md:space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs md:text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base min-h-[44px]"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs md:text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base min-h-[44px]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm md:text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 min-h-[44px]"
          >
            {isLoading ? 'Loading...' : 'Login'}
          </button>
          <div className="text-center space-y-2">
            <Link to="/register" className="text-blue-600 hover:text-blue-700 block text-sm md:text-base min-h-[44px] flex items-center justify-center">
              Don't have an account? Register
            </Link>
            <Link to="/forgot-password" className="text-xs md:text-sm text-gray-600 hover:text-gray-900 block min-h-[44px] flex items-center justify-center">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
