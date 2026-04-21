import { TableSkeleton } from '@/components/ui/Skeleton'
import type { User } from '../types'

interface UserTableProps {
  users: User[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  loading?: boolean
}

export default function UserTable({ users, onView, onEdit, onDelete, loading }: UserTableProps) {
  if (loading) return <TableSkeleton rows={6} columns={6} />

  if (users.length === 0) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">No employees found</div>
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Employee ID</th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                <th className="px-4 lg:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.employee_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 lg:px-6 py-4 text-sm text-gray-900 dark:text-white">{user.employee_id}</td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.job_position}</div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-4 lg:px-6 py-4">
                    {user.has_account ? (
                      <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">Has Account</span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">No Account</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <span className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                      {user.role_name || 'No Role'}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-center">
                    <div className="flex gap-1 justify-center">
                      <button type="button" onClick={() => onView(user.employee_id)} className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">View</button>
                      {user.has_account && (
                        <>
                          <button type="button" onClick={() => onEdit(user.employee_id)} className="px-3 py-1 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">Edit</button>
                          {user.role_id && (
                            <button type="button" onClick={() => onDelete(user.employee_id)} className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">Delete</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {users.map((user) => (
          <div key={user.employee_id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{user.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user.job_position} · {user.employee_id}</p>
              </div>
              {user.has_account ? (
                <span className="px-2 py-0.5 text-[10px] rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 shrink-0">Account</span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 shrink-0">No Account</span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">{user.email}</p>
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                {user.role_name || 'No Role'}
              </span>
              <div className="flex gap-2">
                <button onClick={() => onView(user.employee_id)} className="text-xs text-blue-600 dark:text-blue-400 font-medium">View</button>
                {user.has_account && (
                  <button onClick={() => onEdit(user.employee_id)} className="text-xs text-green-600 dark:text-green-400 font-medium">Edit</button>
                )}
                {user.has_account && user.role_id && (
                  <button onClick={() => onDelete(user.employee_id)} className="text-xs text-red-600 dark:text-red-400 font-medium">Delete</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
