import { useState, useEffect } from 'react'
import { usePermissionsStore } from '../store/permissions.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import api from '@/lib/axios'

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"

const permFields = ['can_view', 'can_insert', 'can_update', 'can_delete', 'can_approve', 'can_release'] as const
type PermField = typeof permFields[number]
const permLabels = ['View', 'Insert', 'Update', 'Delete', 'Approve', 'Release']

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
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<{ id: string; name: string } | null>(null)
  const { success, error: showError } = useToast()

  useEffect(() => { fetchModules(); fetchRoles() }, [fetchModules, fetchRoles])
  useEffect(() => { if (selectedRole) fetchRolePermissions(selectedRole) }, [selectedRole, fetchRolePermissions])

  const handlePermissionChange = (moduleId: string, field: PermField, value: boolean) => updatePermissionLocal(moduleId, field, value)

  const handleSave = async () => {
    if (!selectedRole) return
    try { await savePermissions(selectedRole); await reloadUserPermissions(); success('Permissions saved successfully') }
    catch (err: unknown) { showError(parseApiError(err, 'Gagal menyimpan permissions')) }
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) { showError('Role name is required'); return }
    setCreateSaving(true)
    try {
      await api.post('/permissions/roles', newRole)
      setShowModal(false); setNewRole({ name: '', description: '' }); await fetchRoles(); success('Role created successfully')
    } catch (err: unknown) {
      showError(parseApiError(err, 'Gagal membuat role'))
    } finally { setCreateSaving(false) }
  }

  const handleEditRole = async () => {
    if (!editRole.name.trim()) { showError('Role name is required'); return }
    setCreateSaving(true)
    try {
      await api.put(`/permissions/roles/${editRole.id}`, { name: editRole.name, description: editRole.description })
      setEditModal(false); await fetchRoles(); success('Role updated successfully')
    } catch (err: unknown) {
      showError(parseApiError(err, 'Gagal memperbarui role'))
    } finally { setCreateSaving(false) }
  }

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    setDeleteRoleTarget({ id: roleId, name: roleName })
  }

  const confirmDeleteRole = async () => {
    if (!deleteRoleTarget) return
    try {
      await api.delete(`/permissions/roles/${deleteRoleTarget.id}`)
      setSelectedRole(''); await fetchRoles(); success('Role deleted successfully')
    } catch (err: unknown) {
      showError(parseApiError(err, 'Gagal menghapus role'))
    } finally {
      setDeleteRoleTarget(null)
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

  const handleBulkChange = (field: PermField, value: boolean) => {
    filteredModules.forEach(module => updatePermissionLocal(module.id, field, value))
  }



  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Permissions Management</h1>
          {pendingChanges.size > 0 && (
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">{pendingChanges.size} unsaved change{pendingChanges.size > 1 ? 's' : ''}</p>
          )}
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0">
          + Add Role
        </button>
      </div>

      {storeError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">{storeError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Roles sidebar — horizontal scroll on mobile, vertical on lg */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Roles</h2>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
              {roles.map((role) => (
                <div key={role.id} className="relative shrink-0 lg:shrink">
                  <button
                    onClick={() => setSelectedRole(role.id)}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors min-w-[120px] lg:min-w-0 ${
                      selectedRole === role.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                    } ${!role.is_system_role ? 'pr-16' : ''}`}
                  >
                    <div className="font-medium text-sm">{role.name}</div>
                    <div className="text-xs opacity-75 truncate">{role.description}</div>
                  </button>
                  {!role.is_system_role && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditRole({ id: role.id, name: role.name, description: role.description || '' }); setEditModal(true) }}
                        className="p-1.5 bg-white/80 dark:bg-gray-600/80 rounded hover:bg-gray-100 dark:hover:bg-gray-500 text-xs" title="Edit">✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id, role.name) }}
                        className="p-1.5 bg-white/80 dark:bg-gray-600/80 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-xs" title="Delete">🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Permissions panel */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          ) : selectedRole ? (
            <div className="space-y-4">
              {/* Pending changes bar */}
              {pendingChanges.size > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">{pendingChanges.size} unsaved change{pendingChanges.size > 1 ? 's' : ''}</div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => discardChanges()} disabled={saving} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm">Discard</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm">
                      {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>Saving...</> : '💾 Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <input type="text" placeholder="🔍 Search modules..." value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} />
              </div>

              {/* Journal Workflow Visual */}
              {filteredModules.some(m => m.name === 'journals') && (() => {
                const journalModule = modules.find(m => m.name === 'journals')
                const perm = journalModule ? getPermission(journalModule.id) : null
                const steps = [
                  { icon: '📝', label: 'Create/Edit', field: 'can_update' as PermField },
                  { icon: '📤', label: 'Submit', field: 'can_update' as PermField },
                  { icon: '👍', label: 'Approve', field: 'can_approve' as PermField },
                  { icon: '📥', label: 'Post to GL', field: 'can_release' as PermField },
                  { icon: '↩️', label: 'Reverse', field: 'can_release' as PermField },
                ]
                return (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow border border-blue-200 dark:border-blue-800 p-4 sm:p-6">
                    <h3 className="font-semibold mb-4 text-blue-900 dark:text-blue-300 text-sm">📊 Journal Workflow Permissions</h3>
                    <div className="flex items-center justify-between text-sm overflow-x-auto gap-1 pb-2">
                      {steps.map((step, i) => (
                        <div key={i} className="flex items-center shrink-0">
                          <div className="text-center">
                            <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-1 text-xl sm:text-2xl ${
                              perm?.[step.field] ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-600' : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'
                            }`}>{step.icon}</div>
                            <div className="font-medium text-[10px] sm:text-xs text-gray-900 dark:text-white">{step.label}</div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">{step.field}</div>
                            <div className="text-[10px]">{perm?.[step.field] ? '✅' : '❌'}</div>
                          </div>
                          {i < steps.length - 1 && <div className="w-4 sm:w-8 border-t-2 border-dashed border-gray-400 dark:border-gray-600 mx-1"></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Permissions table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Module</th>
                        {permLabels.map((label, i) => (
                          <th key={label} className="px-2 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            <div>{label}</div>
                            <div className="flex gap-1 justify-center mt-1">
                              <button onClick={() => handleBulkChange(permFields[i], true)} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">All</button>
                              <span className="text-gray-400">|</span>
                              <button onClick={() => handleBulkChange(permFields[i], false)} className="text-[10px] text-red-600 dark:text-red-400 hover:underline">None</button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredModules.map(module => {
                        const perm = getPermission(module.id)
                        return (
                          <tr key={module.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <div className="font-medium text-gray-900 dark:text-white text-sm">{module.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{module.description}</div>
                            </td>
                            {permFields.map(field => (
                              <td key={field} className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={perm ? !!perm[field] : false}
                                  onChange={e => handlePermissionChange(module.id, field, e.target.checked)}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                                />
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
              Select a role to manage permissions
            </div>
          )}
        </div>
      </div>

      {/* Create Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add New Role</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Role Name</label>
                <input type="text" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} className={inputCls} placeholder="e.g. Manager" />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} className={inputCls} rows={3} placeholder="Role description..." />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleCreateRole} disabled={createSaving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {createSaving ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => { setShowModal(false); setNewRole({ name: '', description: '' }) }} disabled={createSaving} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Role</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Role Name</label>
                <input type="text" value={editRole.name} onChange={(e) => setEditRole({ ...editRole, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={editRole.description} onChange={(e) => setEditRole({ ...editRole, description: e.target.value })} className={inputCls} rows={3} />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleEditRole} disabled={createSaving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {createSaving ? 'Updating...' : 'Update'}
              </button>
              <button onClick={() => setEditModal(false)} disabled={createSaving} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Confirm */}
      {deleteRoleTarget && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Role</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Delete role "{deleteRoleTarget.name}"? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={confirmDeleteRole} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Delete</button>
              <button onClick={() => setDeleteRoleTarget(null)} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
