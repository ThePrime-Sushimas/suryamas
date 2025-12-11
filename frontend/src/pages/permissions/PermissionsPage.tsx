import { useState, useEffect } from 'react'
import { permissionService } from '../../services/permissionService'
import type { Role, Module, RoleWithPermissions } from '../../types/permission'
import api from '../../lib/axios'

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', description: '' })
  const [editRole, setEditRole] = useState({ id: '', name: '', description: '' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [rolesData, modulesData] = await Promise.all([
        permissionService.getRoles(),
        permissionService.getModules(),
      ])
      setRoles(rolesData)
      setModules(modulesData)
      if (rolesData.length > 0) {
        loadRolePermissions(rolesData[0].id)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRolePermissions = async (roleId: string) => {
    try {
      const roleData = await permissionService.getRoleById(roleId)
      setSelectedRole(roleData)
    } catch (error) {
      console.error('Failed to load role permissions:', error)
    }
  }

  const handlePermissionChange = (
    moduleId: string,
    permission: string,
    value: boolean
  ) => {
    if (!selectedRole) return

    setPendingChanges(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [permission]: value
      }
    }))
    setHasChanges(true)
  }

  const handleSaveChanges = async () => {
    if (!selectedRole || !hasChanges) return

    setSaving(true)
    try {
      for (const [moduleId, permissions] of Object.entries(pendingChanges)) {
        await permissionService.updatePermission(selectedRole.id, moduleId, permissions)
      }
      
      setPendingChanges({})
      setHasChanges(false)
      await loadRolePermissions(selectedRole.id)
      alert('Permissions saved successfully!')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelChanges = () => {
    setPendingChanges({})
    setHasChanges(false)
  }

  const getPermissionForModule = (moduleId: string) => {
    if (!selectedRole?.perm_role_permissions) return null
    const perm = selectedRole.perm_role_permissions.find((p: any) => p.module_id === moduleId)
    
    // Merge with pending changes
    if (pendingChanges[moduleId]) {
      return { ...perm, ...pendingChanges[moduleId] }
    }
    return perm
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      alert('Role name is required')
      return
    }
    
    try {
      await api.post('/permissions/roles', newRole)
      setShowModal(false)
      setNewRole({ name: '', description: '' })
      await loadData()
      alert('Role created successfully!')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create role')
    }
  }

  const handleEditRole = async () => {
    if (!editRole.name.trim()) {
      alert('Role name is required')
      return
    }
    
    try {
      await api.put(`/permissions/roles/${editRole.id}`, {
        name: editRole.name,
        description: editRole.description
      })
      setEditModal(false)
      await loadData()
      alert('Role updated successfully!')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update role')
    }
  }

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return
    
    try {
      await api.delete(`/permissions/roles/${roleId}`)
      setSelectedRole(null)
      await loadData()
      alert('Role deleted successfully!')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete role')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Permission Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Roles</h2>
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.id} className="relative group">
                  <button
                    onClick={() => loadRolePermissions(role.id)}
                    className={`w-full text-left px-4 py-2 rounded transition ${
                      selectedRole?.id === role.id
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
          {selectedRole ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-lg">{selectedRole.name} Permissions</h2>
                <p className="text-sm text-gray-600">{selectedRole.description}</p>
              </div>

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
                    {modules.map((module) => {
                      const perm = getPermissionForModule(module.id)
                      return (
                        <tr key={module.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium">{module.name}</div>
                            <div className="text-sm text-gray-500">{module.description}</div>
                          </td>
                          {['can_view', 'can_insert', 'can_update', 'can_delete', 'can_approve', 'can_release'].map(
                            (permission) => (
                              <td key={permission} className="px-6 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={perm?.[permission as keyof typeof perm] as boolean || false}
                                  onChange={(e) => handlePermissionChange(module.id, permission, e.target.checked)}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                              </td>
                            )
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {hasChanges && (
                <div className="p-4 bg-yellow-50 border-t flex justify-between items-center">
                  <span className="text-yellow-800">You have unsaved changes</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelChanges}
                      disabled={saving}
                      className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveChanges}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a role
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
                  placeholder="e.g. supervisor"
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
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setNewRole({ name: '', description: '' })
                }}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
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
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Update
              </button>
              <button
                onClick={() => setEditModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
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
