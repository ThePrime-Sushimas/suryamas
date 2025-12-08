import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function HomePage() {
  const { user } = useAuthStore()

  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Welcome to Suryamas</h1>
      <p className="text-xl text-gray-600 mb-8">Finance Management System</p>
      
      {user ? (
        <div className="space-y-4">
          <p className="text-lg">Hello, {user.email}!</p>
          <div className="flex justify-center gap-4">
            <Link
              to="/profile"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              View Profile
            </Link>
            <Link
              to="/employees"
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
            >
              Manage Employees
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-x-4">
          <Link
            to="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
          >
            Register
          </Link>
        </div>
      )}
    </div>
  )
}
