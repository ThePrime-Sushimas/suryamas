import { useState, useEffect } from 'react'
import { usePermissionsStore } from '../store/permissions.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useToast } from '@/contexts/ToastContext'
import api from '@/lib/axios'

export default function PermissionsPage() {
  const { modules, roles, permissions, pendingChanges, loading, saving, error: storeError, fetchModules, fetchRoles, fetchRolePermissions, updatePermissionLocal, savePermissions, discardChanges } = usePermissionsStore()
  const { reload: reloadUserPermissions } = usePermissionStore()
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', description: '' })
  const [editRole, setEditRole] = useState({ id: '', name: '', description: '' })
  const [createSaving, setCreateSaving] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    fetchModules()
    fetchRoles()
  }, [fetchModules, fetchRoles])

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole)
    }
  }, [selectedRole, fetchRolePermissions])

  const handlePermissionChange = (moduleId: string, field: string, value: boolean) => {
    updatePermissionLocal(moduleId, field, value)
  }

  const handleSave = async () => {
    if (!selectedRole) return
    try {
      await savePermissions(selectedRole)
      await reloadUserPermissions()
      success('Permissions saved successfully')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save permissions'
      showError(message)
    }
  }

  const handleDiscard = () => {
    discardChanges()
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      showError('Role name is required')
      return
    }
    
    setCreateSaving(true)
    try {
      await api.post('/permissions/roles', newRole)
      setShowModal(false)
      setNewRole({ name: '', description: '' })
      await fetchRoles()
      success('Role created successfully')
    } catch (err: unknown) {
      const message = err instanceof Error && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data ? String(err.response.data.error) : 'Failed to create role'
      showError(message)
    } finally {
      setCreateSaving(false)
    }
  }

  const handleEditRole = async () => {
    if (!editRole.name.trim()) {
      showError('Role name is required')
      return
    }
    
    setCreateSaving(true)
    try {
      await api.put(`/permissions/roles/${editRole.id}`, {
        name: editRole.name,
        description: editRole.description
      })
      setEditModal(false)
      await fetchRoles()
      success('Role updated successfully')
    } catch (err: unknown) {
      const message = err instanceof Error && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data ? String(err.response.data.error) : 'Failed to update role'
      showError(message)
    } finally {
      setCreateSaving(false)
    }
  }

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return
    
    try {
      await api.delete(`/permissions/roles/${roleId}`)
      setSelectedRole('')
      await fetchRoles()
      success('Role deleted successfully')
    } catch (err: unknown) {
      const message = err instanceof Error && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data ? String(err.response.data.error) : 'Failed to delete role'
      showError(message)
    }
  }

  const getPermission = (moduleId: string) => {
    const perm = permissions.find(p => p.module_id === moduleId)
    const pending = pendingChanges.get(moduleId)
    return perm ? { ...perm, ...pending } : null
  }

  const filteredModules = modules.filter(module =>
    module.name.toLowerCase().includes(search.toLowerCase()) ||
    module.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleBulkChange = (field: string, value: boolean) => {
    filteredModules.forEach(module => {
      updatePermissionLocal(module.id, field, value)
    })
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Permissions Management</h1>
          {pendingChanges.size > 0 && (
            <p className="text-sm text-orange-600 mt-1">
              {pendingChanges.size} unsaved change{pendingChanges.size > 1 ? 's' : ''}
            </p>
          )}
        </div>
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
            <div className="space-y-4">
              {pendingChanges.size > 0 && (
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {pendingChanges.size} unsaved change{pendingChanges.size > 1 ? 's' : ''}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDiscard}
                      disabled={saving}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        '💾 Save Changes'
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow p-4">
                <input
                  type="text"
                  placeholder="🔍 Search modules..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {filteredModules.some(m => m.name === 'journals') && (
                <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6 border border-blue-200">
                  <h3 className="font-semibold mb-4 text-blue-900">📊 Journal Workflow Permissions</h3>
                  <div className="flex items-center justify-between text-sm">
                    {(() => {
                      const journalModule = modules.find(m => m.name === 'journals')
                      const perm = journalModule ? getPermission(journalModule.id) : null
                      return (
                        <>
                          <div className="text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl ${
                              perm?.can_update ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-100 border-2 border-gray-300'
                            }`}>📝</div>
                            <div className="font-medium">Create/Edit</div>
                            <div className="text-xs text-gray-600 mt-1">can_update</div>
                            <div className="text-xs">{perm?.can_update ? '✅' : '❌'}</div>
                          </div>
                          <div className="flex-1 border-t-2 border-dashed border-gray-400 mx-2"></div>
                          <div className="text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl ${
                              perm?.can_update ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-100 border-2 border-gray-300'
                            }`}>📤</div>
                            <div className="font-medium">Submit</div>
                            <div className="text-xs text-gray-600 mt-1">can_update</div>
                            <div className="text-xs">{perm?.can_update ? '✅' : '❌'}</div>
                          </div>
                          <div className="flex-1 border-t-2 border-dashed border-gray-400 mx-2"></div>
                          <div className="text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl ${
                              perm?.can_approve ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-100 border-2 border-gray-300'
                            }`}>👍</div>
                            <div className="font-medium">Approve</div>
                            <div className="text-xs text-gray-600 mt-1">can_approve</div>
                            <div className="text-xs">{perm?.can_approve ? '✅' : '❌'}</div>
                          </div>
                          <div className="flex-1 border-t-2 border-dashed border-gray-400 mx-2"></div>
                          <div className="text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl ${
                              perm?.can_release ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-100 border-2 border-gray-300'
                            }`}>📥</div>
                            <div className="font-medium">Post to GL</div>
                            <div className="text-xs text-gray-600 mt-1">can_release</div>
                            <div className="text-xs">{perm?.can_release ? '✅' : '❌'}</div>
                          </div>
                          <div className="flex-1 border-t-2 border-dashed border-gray-400 mx-2"></div>
                          <div className="text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl ${
                              perm?.can_release ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-100 border-2 border-gray-300'
                            }`}>↩️</div>
                            <div className="font-medium">Reverse</div>
                            <div className="text-xs text-gray-600 mt-1">can_release</div>
                            <div className="text-xs">{perm?.can_release ? '✅' : '❌'}</div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Module</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          <div>View</div>
                          <div className="flex gap-1 justify-center mt-1">
                            <button onClick={() => handleBulkChange('can_view', true)} className="text-xs text-blue-600 hover:underline">All</button>
                            <span className="text-gray-400">|</span>
                            <button onClick={() => handleBulkChange('can_view', false)} className="text-xs text-red-600 hover:underline">None</button>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          <div>Insert</div>
                          <div className="flex gap-1 justify-center mt-1">
                            <button onClick={() => handleBulkChange('can_insert', true)} className="text-xs text-blue-600 hover:underline">All</button>
                            <span className="text-gray-400">|</span>
                            <button onClick={() => handleBulkChange('can_insert', false)} className="text-xs text-red-600 hover:underline">None</button>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          <div>Update</div>
                          <div className="flex gap-1 justify-center mt-1">
                            <button onClick={() => handleBulkChange('can_update', true)} className="text-xs text-blue-600 hover:underline">All</button>
                            <span className="text-gray-400">|</span>
                            <button onClick={() => handleBulkChange('can_update', false)} className="text-xs text-red-600 hover:underline">None</button>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          <div>Delete</div>
                          <div className="flex gap-1 justify-center mt-1">
                            <button onClick={() => handleBulkChange('can_delete', true)} className="text-xs text-blue-600 hover:underline">All</button>
                            <span className="text-gray-400">|</span>
                            <button onClick={() => handleBulkChange('can_delete', false)} className="text-xs text-red-600 hover:underline">None</button>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          <div>Approve</div>
                          <div className="flex gap-1 justify-center mt-1">
                            <button onClick={() => handleBulkChange('can_approve', true)} className="text-xs text-blue-600 hover:underline">All</button>
                            <span className="text-gray-400">|</span>
                            <button onClick={() => handleBulkChange('can_approve', false)} className="text-xs text-red-600 hover:underline">None</button>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          <div>Release</div>
                          <div className="flex gap-1 justify-center mt-1">
                            <button onClick={() => handleBulkChange('can_release', true)} className="text-xs text-blue-600 hover:underline">All</button>
                            <span className="text-gray-400">|</span>
                            <button onClick={() => handleBulkChange('can_release', false)} className="text-xs text-red-600 hover:underline">None</button>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredModules.map(module => {
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
                                disabled={saving}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={perm?.can_insert || false}
                                onChange={e => handlePermissionChange(module.id, 'can_insert', e.target.checked)}
                                disabled={saving}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={perm?.can_update || false}
                                onChange={e => handlePermissionChange(module.id, 'can_update', e.target.checked)}
                                disabled={saving}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={perm?.can_delete || false}
                                onChange={e => handlePermissionChange(module.id, 'can_delete', e.target.checked)}
                                disabled={saving}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={perm?.can_approve || false}
                                onChange={e => handlePermissionChange(module.id, 'can_approve', e.target.checked)}
                                disabled={saving}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={perm?.can_release || false}
                                onChange={e => handlePermissionChange(module.id, 'can_release', e.target.checked)}
                                disabled={saving}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a role to manage permissions
            </div>
          )}
        </div>
      </div>

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
                disabled={createSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {createSaving ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setNewRole({ name: '', description: '' })
                }}
                disabled={createSaving}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                disabled={createSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {createSaving ? 'Updating...' : 'Update'}
              </button>
              <button
                onClick={() => setEditModal(false)}
                disabled={createSaving}
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
