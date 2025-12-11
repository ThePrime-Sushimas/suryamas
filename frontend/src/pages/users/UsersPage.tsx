import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { userService } from '../../services/userService'
import type { User } from '../../services/userService'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set())
  const itemsPerPage = 10
  const navigate = useNavigate()

  const toggleBranch = (branch: string) => {
    setCollapsedBranches(prev => {
      const newSet = new Set(prev)
      if (newSet.has(branch)) {
        newSet.delete(branch)
      } else {
        newSet.add(branch)
      }
      return newSet
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchQuery, selectedBranch])

  useEffect(() => {
    // Set all branches as collapsed by default on initial load
    if (users.length > 0 && collapsedBranches.size === 0) {
      const branches = Array.from(new Set(users.map(u => u.branch)))
      setCollapsedBranches(new Set(branches))
    }
  }, [users])

  const loadData = async () => {
    try {
      const usersData = await userService.getAll()
      setUsers(usersData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users

    if (searchQuery) {
      filtered = filtered.filter(u =>
        (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedBranch !== 'all') {
      filtered = filtered.filter(u => u.branch === selectedBranch)
    }

    setFilteredUsers(filtered)
    setCurrentPage(1)
  }

  const handleDelete = async (employeeId: string) => {
    if (!confirm('Remove role from this employee?')) return
    
    try {
      await userService.removeRole(employeeId)
      await loadData()
      alert('Role removed successfully!')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove role')
    }
  }

  const branches = ['all', ...Array.from(new Set(users.map(u => u.branch)))]
  const groupedUsers = filteredUsers.reduce((acc, user) => {
    if (!acc[user.branch]) acc[user.branch] = []
    acc[user.branch].push(user)
    return acc
  }, {} as Record<string, User[]>)

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage)

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search by name, ID, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Branches</option>
          {branches.filter(b => b !== 'all').map(branch => (
            <option key={branch} value={branch}>{branch}</option>
          ))}
        </select>
      </div>

      {selectedBranch === 'all' ? (
        Object.entries(groupedUsers).map(([branch, branchUsers]) => (
          <div key={branch} className="mb-6">
            <h2 
              onClick={() => toggleBranch(branch)}
              className="text-lg font-semibold mb-3 px-4 py-2 bg-gray-100 rounded cursor-pointer hover:bg-gray-200 flex justify-between items-center"
            >
              <span>{branch} ({branchUsers.length})</span>
              <span>{collapsedBranches.has(branch) ? '▼' : '▲'}</span>
            </h2>
            {!collapsedBranches.has(branch) && (
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
                  {branchUsers.map((user) => (
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
                            onClick={() => navigate(`/users/${user.employee_id}`)}
                            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                          >
                            View
                          </button>
                          {user.has_account && (
                            <>
                              <button
                                onClick={() => navigate(`/users/edit/${user.employee_id}`)}
                                className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                              >
                                Edit
                              </button>
                              {user.role_id && (
                                <button
                                  onClick={() => handleDelete(user.employee_id)}
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
            </div>
            )}
          </div>
        ))
      ) : (
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
              {paginatedUsers.map((user) => (
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
                        onClick={() => navigate(`/users/${user.employee_id}`)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                      >
                        View
                      </button>
                      {user.has_account && (
                        <>
                          <button
                            onClick={() => navigate(`/users/edit/${user.employee_id}`)}
                            className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                          >
                            Edit
                          </button>
                          {user.role_id && (
                            <button
                              onClick={() => handleDelete(user.employee_id)}
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

          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-gray-500">No employees found</div>
          )}
        </div>
      )}

      {selectedBranch !== 'all' && totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
