import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import MobileDrawer from '../mobile/MobileDrawer'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {user && (
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="md:hidden mr-3 p-2 rounded-md text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <Link to="/" className="flex items-center text-lg md:text-xl font-bold text-gray-900">
                Suryamas
              </Link>
              {user && (
                <div className="hidden md:flex ml-10 items-center space-x-4">
                  <Link to="/employees" className="text-gray-700 hover:text-gray-900">
                    Employees
                  </Link>
                  <Link to="/permissions" className="text-gray-700 hover:text-gray-900">
                    Permissions
                  </Link>
                  <Link to="/users" className="text-gray-700 hover:text-gray-900">
                    Users
                  </Link>
                </div>
              )}
            </div>
            <div className="flex items-center">
              {user ? (
                <div className="flex items-center space-x-2 md:space-x-4">
                  <Link to="/profile" className="hidden md:flex items-center text-xl font-bold text-gray-900">
                    <span className="mx-2">{user.full_name}</span>
                    <span className="text-sm text-blue-900">({user.job_position})</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-3 md:px-4 py-2 rounded hover:bg-red-700 text-sm md:text-base min-h-[44px]"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded hover:bg-blue-700 text-sm md:text-base min-h-[44px]"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  )
}
