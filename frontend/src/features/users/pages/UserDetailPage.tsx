import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersApi } from '@/features/users'
import type { User } from '@/features/users'

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const loadData = async () => {
      try { setUser(await usersApi.getById(id)) }
      catch { setUser(null) }
      finally { setLoading(false) }
    }
    loadData()
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">Loading...</div>
  if (!user) return <div className="p-4 sm:p-6 text-gray-500 dark:text-gray-400">User not found</div>

  const infoCls = "font-medium text-base sm:text-lg text-gray-900 dark:text-white"
  const labelCls = "text-sm text-gray-600 dark:text-gray-400"

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mb-4 sm:mb-6">
        <button onClick={() => navigate('/users')} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          ← Back to Users
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-6 max-w-2xl">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">User Details</h1>

        <div className="space-y-4">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <label className={labelCls}>Employee ID</label>
            <div className={infoCls}>{user.employee_id}</div>
          </div>
          <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <label className={labelCls}>Full Name</label>
            <div className={infoCls}>{user.full_name}</div>
          </div>
          <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <label className={labelCls}>Job Position</label>
            <div className={infoCls}>{user.job_position}</div>
          </div>
          <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <label className={labelCls}>Email</label>
            <div className={`${infoCls} break-all`}>{user.email}</div>
          </div>
          <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <label className={labelCls}>Role</label>
            <div className="mt-1">
              <span className="px-3 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-sm font-medium">
                {user.role_name || 'No Role'}
              </span>
            </div>
            {user.role_description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{user.role_description}</p>}
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button onClick={() => navigate(`/users/edit/${user.employee_id}`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            Edit Role
          </button>
          <button onClick={() => navigate('/users')} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium">
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
