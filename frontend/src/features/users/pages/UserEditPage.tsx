import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { usersApi } from '@/features/users'
import type { User } from '@/features/users'
import { permissionsApi } from '@/features/permissions'
import type { Role } from '@/features/permissions'

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"

export default function UserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [userData, rolesData] = await Promise.all([usersApi.getById(id), permissionsApi.getRoles()])
      setUser(userData)
      setSelectedRole(userData.role_id || '')
      setRoles(rolesData)
      setError(null)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to load data')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !selectedRole) return
    setLoading(true)
    setError(null)
    try {
      await usersApi.assignRole(id, selectedRole)
      toast.success('Role berhasil diupdate')
      navigate('/users')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update role'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">Loading...</div>
  if (!user) return <div className="p-4 sm:p-6 text-gray-500 dark:text-gray-400">{error || 'User not found'}</div>

  if (!user.has_account) {
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-400 p-4 rounded-lg max-w-2xl">
          <p className="font-medium">Cannot assign role</p>
          <p className="text-sm mt-1">Employee {user.full_name} has not registered yet. Please register first.</p>
          <button onClick={() => navigate('/users')} className="mt-3 text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Users</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mb-4 sm:mb-6">
        <button onClick={() => navigate('/users')} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Users</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-6 max-w-2xl">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit User Role</h1>

        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Employee ID</label>
              <div className="font-medium text-gray-900 dark:text-white">{user.employee_id}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Full Name</label>
              <div className="font-medium text-gray-900 dark:text-white">{user.full_name}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Job Position</label>
              <div className="font-medium text-gray-900 dark:text-white">{user.job_position}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
              <div className="font-medium text-gray-900 dark:text-white break-all">{user.email}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className={inputCls} required>
              <option value="">Select Role</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            {user.role_description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{user.role_description}</p>}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => navigate('/users')} disabled={loading} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
