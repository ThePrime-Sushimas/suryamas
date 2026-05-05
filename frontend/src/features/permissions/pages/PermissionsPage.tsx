import { useState, useEffect } from 'react'
import { usePermissionsStore } from '../store/permissions.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import api from '@/lib/axios'
import { Shield, Plus, Search, Save, Undo2, Edit, Trash2, X } from 'lucide-react'

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
    try { await savePermissions(selectedRole); await reloadUserPermissions(); success('Hak akses berhasil disimpan') }
    catch (err: unknown) { showError(parseApiError(err, 'Gagal menyimpan')) }
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) { showError('Nama role wajib diisi'); return }
    setCreateSaving(true)
    try {
      await api.post('/permissions/roles', newRole)
      setShowModal(false); setNewRole({ name: '', description: '' }); await fetchRoles(); success('Role berhasil dibuat')
    } catch (err: unknown) { showError(parseApiError(err, 'Gagal membuat role')) }
    finally { setCreateSaving(false) }
  }

  const handleEditRole = async () => {
    if (!editRole.name.trim()) { showError('Nama role wajib diisi'); return }
    setCreateSaving(true)
    try {
      await api.put(`/permissions/roles/${editRole.id}`, { name: editRole.name, description: editRole.description })
      setEditModal(false); await fetchRoles(); success('Role berhasil diperbarui')
    } catch (err: unknown) { showError(parseApiError(err, 'Gagal memperbarui role')) }
    finally { setCreateSaving(false) }
  }

  const confirmDeleteRole = async () => {
    if (!deleteRoleTarget) return
    try {
      await api.delete(`/permissions/roles/${deleteRoleTarget.id}`)
      setSelectedRole(''); await fetchRoles(); success('Role berhasil dihapus')
    } catch (err: unknown) { showError(parseApiError(err, 'Gagal menghapus role')) }
    finally { setDeleteRoleTarget(null) }
  }

  const getPermission = (moduleId: string) => {
    const perm = permissions.find(p => p.module_id === moduleId)
    const pending = pendingChanges.get(moduleId)
    return perm ? { ...perm, ...pending } : null
  }

  const filteredModules = modules.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleBulkChange = (field: PermField, value: boolean) => {
    filteredModules.forEach(m => updatePermissionLocal(m.id, field, value))
  }

  const selectedRoleName = roles.find(r => r.id === selectedRole)?.name || ''

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Hak Akses</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {roles.length} role · {modules.length} modul
                {pendingChanges.size > 0 && <span className="text-orange-500 ml-2">· {pendingChanges.size} belum disimpan</span>}
              </p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">
            <Plus className="w-3.5 h-3.5" />
            Tambah Role
          </button>
        </div>
      </div>

      {storeError && (
        <div className="shrink-0 mx-4 mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-xs">{storeError}</div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Roles sidebar */}
        <div className="shrink-0 w-48 lg:w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Roles</p>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
            {roles.map(role => (
              <div
                key={role.id}
                className={`group relative rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  selectedRole === role.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedRole(role.id)}
              >
                <p className={`text-xs font-medium truncate ${selectedRole === role.id ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{role.name}</p>
                {role.description && (
                  <p className={`text-[10px] truncate ${selectedRole === role.id ? 'text-blue-100' : 'text-gray-400'}`}>{role.description}</p>
                )}
                {!role.is_system_role && selectedRole !== role.id && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); setEditRole({ id: role.id, name: role.name, description: role.description || '' }); setEditModal(true) }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="Ubah">
                      <Edit className="w-3 h-3 text-gray-500" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteRoleTarget({ id: role.id, name: role.name }) }}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" title="Hapus">
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Permissions panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : selectedRole ? (
            <>
              {/* Toolbar */}
              <div className="shrink-0 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Cari modul..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                {pendingChanges.size > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-orange-600 dark:text-orange-400">{pendingChanges.size} perubahan</span>
                    <button onClick={() => discardChanges()} disabled={saving} className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Batalkan">
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                      <Save className="w-3.5 h-3.5" />
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[200px]">
                        Modul
                        <span className="ml-2 text-[10px] text-gray-400 font-normal">({filteredModules.length})</span>
                      </th>
                      {permLabels.map((label, i) => (
                        <th key={label} className="px-2 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-20">
                          <div className="text-[11px]">{label}</div>
                          <div className="flex gap-1 justify-center mt-0.5">
                            <button onClick={() => handleBulkChange(permFields[i], true)} className="text-[9px] text-blue-600 dark:text-blue-400 hover:underline">All</button>
                            <button onClick={() => handleBulkChange(permFields[i], false)} className="text-[9px] text-red-500 dark:text-red-400 hover:underline">None</button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModules.map((module, idx) => {
                      const perm = getPermission(module.id)
                      const hasPending = pendingChanges.has(module.id)
                      return (
                        <tr key={module.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'} ${hasPending ? 'ring-1 ring-inset ring-orange-200 dark:ring-orange-800' : ''} hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors`}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-900 dark:text-white">{module.name}</p>
                            {module.description && <p className="text-[10px] text-gray-400 truncate max-w-[250px]">{module.description}</p>}
                          </td>
                          {permFields.map(field => (
                            <td key={field} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={perm ? !!perm[field] : false}
                                onChange={e => handlePermissionChange(module.id, field, e.target.checked)}
                                disabled={saving}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 disabled:opacity-50"
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <Shield className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Pilih role untuk mengatur hak akses</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Tambah Role Baru</h2>
              <button onClick={() => { setShowModal(false); setNewRole({ name: '', description: '' }) }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Role</label>
                <input type="text" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Contoh: Manager" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                <textarea value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" rows={2} placeholder="Deskripsi role..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleCreateRole} disabled={createSaving} className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {createSaving ? 'Membuat...' : 'Buat'}
              </button>
              <button onClick={() => { setShowModal(false); setNewRole({ name: '', description: '' }) }} disabled={createSaving} className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 font-medium">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Ubah Role</h2>
              <button onClick={() => setEditModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Role</label>
                <input type="text" value={editRole.name} onChange={(e) => setEditRole({ ...editRole, name: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                <textarea value={editRole.description} onChange={(e) => setEditRole({ ...editRole, description: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleEditRole} disabled={createSaving} className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {createSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setEditModal(false)} disabled={createSaving} className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 font-medium">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Confirm */}
      {deleteRoleTarget && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-xs shadow-xl">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Hapus Role</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Hapus role "{deleteRoleTarget.name}"? Semua karyawan dengan role ini akan kehilangan aksesnya.</p>
            <div className="flex gap-2">
              <button onClick={confirmDeleteRole} className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 font-medium">Hapus</button>
              <button onClick={() => setDeleteRoleTarget(null)} className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
