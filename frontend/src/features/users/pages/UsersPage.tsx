import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi } from '@/features/users'
import { useToast } from '@/contexts/ToastContext'
import type { User } from '@/features/users'
import UserTable from '../components/UserTable'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(() => new Set())
  const itemsPerPage = 10
  const navigate = useNavigate()
  const { error: showError, success } = useToast()

  const loadData = useCallback(async () => {
    try {
      const usersData = await usersApi.getAll()
      setUsers(usersData)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [showError])

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
  }, [loadData])

  useEffect(() => {
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
  }, [users, searchQuery, selectedBranch])

  useEffect(() => {
    // Set all branches as collapsed by default on initial load
    const branches = Array.from(new Set(users.map(u => u.branch)))
    setCollapsedBranches(new Set(branches))
  }, [users])

  const handleDelete = async (employeeId: string) => {
    if (!confirm('Remove role from this employee?')) return
    
    try {
      await usersApi.removeRole(employeeId)
      success('Role removed successfully')
      await loadData()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to remove role'
      showError(message)
    }
  }

  const branches = useMemo(() => 
    ['all', ...Array.from(new Set(users.map(u => u.branch)))],
    [users]
  )

  const groupedUsers = useMemo(() => {
    if (selectedBranch !== 'all') return {}
    return filteredUsers.reduce((acc, user) => {
      if (!acc[user.branch]) acc[user.branch] = []
      acc[user.branch].push(user)
      return acc
    }, {} as Record<string, User[]>)
  }, [filteredUsers, selectedBranch])

  const { totalPages, paginatedUsers } = useMemo(() => {
    if (selectedBranch === 'all') return { totalPages: 0, paginatedUsers: [] }
    const total = Math.ceil(filteredUsers.length / itemsPerPage)
    const start = (currentPage - 1) * itemsPerPage
    return {
      totalPages: total,
      paginatedUsers: filteredUsers.slice(start, start + itemsPerPage)
    }
  }, [filteredUsers, currentPage, selectedBranch])

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
              <UserTable
                users={branchUsers}
                onView={(id) => navigate(`/users/${id}`)}
                onEdit={(id) => navigate(`/users/edit/${id}`)}
                onDelete={handleDelete}
              />
            )}
          </div>
        ))
      ) : (
        <UserTable
          users={paginatedUsers}
          onView={(id) => navigate(`/users/${id}`)}
          onEdit={(id) => navigate(`/users/edit/${id}`)}
          onDelete={handleDelete}
        />
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
