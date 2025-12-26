import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUsersStore } from '../store/users.store'

export default function UsersPage() {
  const navigate = useNavigate()
  const { users, loading, fetchUsers } = useUsersStore()

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Users Management</h1>
      
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2 text-left">Employee ID</th>
                <th className="border px-4 py-2 text-left">Name</th>
                <th className="border px-4 py-2 text-left">Email</th>
                <th className="border px-4 py-2 text-left">Branch</th>
                <th className="border px-4 py-2 text-left">Has Account</th>
                <th className="border px-4 py-2 text-left">Role</th>
                <th className="border px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.employee_id} className="hover:bg-gray-50">
                  <td className="border px-4 py-2">{user.employee_id}</td>
                  <td className="border px-4 py-2 font-semibold">{user.full_name}</td>
                  <td className="border px-4 py-2">{user.email}</td>
                  <td className="border px-4 py-2">{user.branch}</td>
                  <td className="border px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${user.has_account ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {user.has_account ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="border px-4 py-2">{user.role_name || '-'}</td>
                  <td className="border px-4 py-2">
                    <button
                      onClick={() => navigate(`/users/edit/${user.employee_id}`)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Manage Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
