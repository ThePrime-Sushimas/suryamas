import type { User } from '../types'

interface UserTableProps {
  users: User[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export default function UserTable({ users, onView, onEdit, onDelete }: UserTableProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.employee_id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm">{user.employee_id}</td>
              <td className="px-6 py-4">
                <div className="font-medium">{user.full_name}</div>
                <div className="text-xs text-gray-500">{user.job_position}</div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
              <td className="px-6 py-4">
                {user.has_account ? (
                  <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                    Has Account
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                    No Account
                  </span>
                )}
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                  {user.role_name || 'No Role'}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => onView(user.employee_id)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    View
                  </button>
                  {user.has_account && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(user.employee_id)}
                        className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                      >
                        Edit
                      </button>
                      {user.role_id && (
                        <button
                          type="button"
                          onClick={() => onDelete(user.employee_id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          <table className="w-full">
            <tbody>
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No employees found
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
