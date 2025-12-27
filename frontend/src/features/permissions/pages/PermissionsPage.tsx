import { useState, useEffect } from 'react'
import { usePermissionsStore } from '../store/permissions.store'
import { useToast } from '@/contexts/ToastContext'
import api from '@/lib/axios'

export default function PermissionsPage() {
  const { modules, roles, permissions, loading, error: storeError, fetchModules, fetchRoles, fetchRolePermissions, updatePermission } = usePermissionsStore()
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', description: '' })
  const [editRole, setEditRole] = useState({ id: '', name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    fetchModules()
    fetchRoles()
  }, [])

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole)
    }
  }, [selectedRole])

  const handlePermissionChange = async (moduleId: string, field: string, value: boolean) => {
    if (!selectedRole) return
    try {
      await updatePermission(selectedRole, moduleId, { [field]: value })
      success('Permission updated')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update permission'
      showError(message)
    }
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      showError('Role name is required')
      return
    }
    
    setSaving(true)
    try {
      await api.post('/permissions/roles', newRole)
      setShowModal(false)
      setNewRole({ name: '', description: '' })
      await fetchRoles()
      success('Role created successfully')
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  const handleEditRole = async () => {
    if (!editRole.name.trim()) {
      showError('Role name is required')
      return
    }
    
    setSaving(true)
    try {
      await api.put(`/permissions/roles/${editRole.id}`, {
        name: editRole.name,
        description: editRole.description
      })
      setEditModal(false)
      await fetchRoles()
      success('Role updated successfully')
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return
    
    try {
      await api.delete(`/permissions/roles/${roleId}`)
      setSelectedRole('')
      await fetchRoles()
      success('Role deleted successfully')
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to delete role')
    }
  }

  const getPermission = (moduleId: string) => {
    return permissions.find(p => p.module_id === moduleId)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Permissions Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Role
        </button>
      </div>

      {storeError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {storeError}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-4">Roles</h2>
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.id} className="relative group">
                  <button
                    onClick={() => setSelectedRole(role.id)}
                    className={`w-full text-left px-4 py-2 rounded transition ${
                      selectedRole === role.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs opacity-75">{role.description}</div>
                  </button>
                  {!role.is_system_role && (
                    <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditRole({ id: role.id, name: role.name, description: role.description || '' })
                          setEditModal(true)
                        }}
                        className="p-1 bg-white rounded hover:bg-gray-100 text-gray-600"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteRole(role.id, role.name)
                        }}
                        className="p-1 bg-white rounded hover:bg-red-100 text-red-600"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : selectedRole ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Module</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">View</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Insert</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Update</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Delete</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Approve</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Release</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {modules.map(module => {
                      const perm = getPermission(module.id)
                      return (
                        <tr key={module.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium">{module.name}</div>
                            <div className="text-sm text-gray-500">{module.description}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm?.can_view || false}
                              onChange={e => handlePermissionChange(module.id, 'can_view', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm?.can_insert || false}
                              onChange={e => handlePermissionChange(module.id, 'can_insert', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm?.can_update || false}
                              onChange={e => handlePermissionChange(module.id, 'can_update', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm?.can_delete || false}
                              onChange={e => handlePermissionChange(module.id, 'can_delete', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm?.can_approve || false}
                              onChange={e => handlePermissionChange(module.id, 'can_approve', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={perm?.can_release || false}
                              onChange={e => handlePermissionChange(module.id, 'can_release', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a role to manage permissions
            </div>
          )}
        </div>
      </div>

      {/* Add Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Role</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role Name</label>
                <input
                  type="text"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Manager"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Role description..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreateRole}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setNewRole({ name: '', description: '' })
                }}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Role</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role Name</label>
                <input
                  type="text"
                  value={editRole.name}
                  onChange={(e) => setEditRole({ ...editRole, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editRole.description}
                  onChange={(e) => setEditRole({ ...editRole, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleEditRole}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Update'}
              </button>
              <button
                onClick={() => setEditModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
