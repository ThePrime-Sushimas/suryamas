import { Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'

export default function HomePage() {
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-gray-900">Suryamas</h1>
          <p className="text-2xl text-gray-600 mb-2">Finance Management System</p>
          <p className="text-gray-500">Manage employees and permissions efficiently</p>
        </div>

        {user ? (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold mb-6">Welcome, {user.full_name}!</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link
                to="/profile"
                className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 text-center font-semibold"
              >
                View Profile
              </Link>
              <Link
                to="/employees"
                className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 text-center font-semibold"
              >
                Manage Employees
              </Link>
              <Link
                to="/permissions"
                className="bg-purple-600 text-white px-6 py-4 rounded-lg hover:bg-purple-700 text-center font-semibold"
              >
                Permissions
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-lg text-gray-600 mb-6">Please login to access the system</p>
            <div className="flex justify-center gap-4">
              <Link
                to="/login"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-gray-600 text-white px-8 py-3 rounded-lg hover:bg-gray-700 font-semibold"
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
