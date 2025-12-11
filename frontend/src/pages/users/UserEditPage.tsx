import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { userService } from '../../services/userService'
import type { User } from '../../services/userService'
import { permissionService } from '../../services/permissionService'
import type { Role } from '../../types/permission'

export default function UserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      const [usersData, rolesData] = await Promise.all([
        userService.getAll(),
        permissionService.getRoles(),
      ])
      const userData = usersData.find(u => u.employee_id === id)
      setUser(userData || null)
      setSelectedRole(userData?.role_id || '')
      setRoles(rolesData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    try {
      await userService.assignRole(id, selectedRole)
      alert('Role updated successfully!')
      navigate('/users')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update role')
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => navigate('/users')}
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
