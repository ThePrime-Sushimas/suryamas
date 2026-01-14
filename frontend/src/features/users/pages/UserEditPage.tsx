import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersApi } from '@/features/users'
import type { User } from '@/features/users'
import { permissionsApi } from '@/features/permissions'
import type { Role } from '@/features/permissions'

export default function UserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [userData, rolesData] = await Promise.all([
        usersApi.getById(id),
        permissionsApi.getRoles(),
      ])
      setUser(userData)
      setSelectedRole(userData.role_id || '')
      setRoles(rolesData)
      setError(null)
    } catch (error: unknown) {
      console.error('Error loading data:', error)
      const message = error instanceof Error ? error.message : 'Failed to load data'
      setError(message)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !selectedRole) return

    setLoading(true)
    setError(null)
    try {
      await usersApi.assignRole(id, selectedRole)
      navigate('/users')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update role'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!user) {
    return <div className="p-6">{error || 'User not found'}</div>
  }

  if (!user.has_account) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded">
          <p className="font-medium">Cannot assign role</p>
          <p className="text-sm mt-1">Employee {user.full_name} has not registered yet. Please register first.</p>
          <button onClick={() => navigate('/users')} className="mt-3 text-blue-600 hover:underline">
            ← Back to Users
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button onClick={() => navigate('/users')} className="text-blue-600 hover:underline">
          ← Back to Users
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Edit User Role</h1>

        <div className="mb-6 p-4 bg-gray-50 rounded">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Employee ID</label>
              <div className="font-medium">{user.employee_id}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Full Name</label>
              <div className="font-medium">{user.full_name}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Job Position</label>
              <div className="font-medium">{user.job_position}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <div className="font-medium">{user.email}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {user.role_description && (
              <p className="text-sm text-gray-500 mt-1">{user.role_description}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/users')}
              disabled={loading}
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
