import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { userService } from '../../services/userService'
import type { User } from '../../services/userService'

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      const usersData = await userService.getAll()
      const userData = usersData.find(u => u.employee_id === id)
      setUser(userData || null)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!user) {
    return <div className="p-6">User not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button onClick={() => navigate('/users')} className="text-blue-600 hover:underline">
          ← Back to Users
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">User Details</h1>

        <div className="space-y-4">
          <div className="border-b pb-3">
            <label className="text-sm text-gray-600">Employee ID</label>
            <div className="font-medium text-lg">{user.employee_id}</div>
          </div>

          <div className="border-b pb-3">
            <label className="text-sm text-gray-600">Full Name</label>
            <div className="font-medium text-lg">{user.full_name}</div>
          </div>

          <div className="border-b pb-3">
            <label className="text-sm text-gray-600">Job Position</label>
            <div className="font-medium text-lg">{user.job_position}</div>
          </div>

          <div className="border-b pb-3">
            <label className="text-sm text-gray-600">Email</label>
            <div className="font-medium text-lg">{user.email}</div>
          </div>

          <div className="border-b pb-3">
            <label className="text-sm text-gray-600">Role</label>
            <div className="font-medium text-lg">
              <span className="px-3 py-1 rounded bg-blue-100 text-blue-800">
                {user.role_name || 'No Role'}
              </span>
            </div>
            {user.role_description && (
              <p className="text-sm text-gray-500 mt-2">{user.role_description}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate(`/users/edit/${user.employee_id}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Role
          </button>
          <button
            onClick={() => navigate('/users')}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
