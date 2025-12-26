import { useState, useEffect } from 'react'
import { usePermissionsStore } from '../store/permissions.store'

export default function PermissionsPage() {
  const { modules, roles, permissions, loading, fetchModules, fetchRoles, fetchRolePermissions, updatePermission } = usePermissionsStore()
  const [selectedRole, setSelectedRole] = useState<string>('')

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
    } catch (error) {
      console.error('Failed to update permission')
    }
  }

  const getPermission = (moduleId: string) => {
    return permissions.find(p => p.module_id === moduleId)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Permissions Management</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Select Role</label>
        <select
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value)}
          className="w-full max-w-md px-3 py-2 border rounded-md"
        >
          <option value="">-- Select Role --</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : selectedRole ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2 text-left">Module</th>
                <th className="border px-4 py-2 text-center">View</th>
                <th className="border px-4 py-2 text-center">Insert</th>
                <th className="border px-4 py-2 text-center">Update</th>
                <th className="border px-4 py-2 text-center">Delete</th>
                <th className="border px-4 py-2 text-center">Approve</th>
                <th className="border px-4 py-2 text-center">Release</th>
              </tr>
            </thead>
            <tbody>
              {modules.map(module => {
                const perm = getPermission(module.id)
                return (
                  <tr key={module.id} className="hover:bg-gray-50">
                    <td className="border px-4 py-2 font-medium">{module.name}</td>
                    <td className="border px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={perm?.can_view || false}
                        onChange={e => handlePermissionChange(module.id, 'can_view', e.target.checked)}
                      />
                    </td>
                    <td className="border px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={perm?.can_insert || false}
                        onChange={e => handlePermissionChange(module.id, 'can_insert', e.target.checked)}
                      />
                    </td>
                    <td className="border px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={perm?.can_update || false}
                        onChange={e => handlePermissionChange(module.id, 'can_update', e.target.checked)}
                      />
                    </td>
                    <td className="border px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={perm?.can_delete || false}
                        onChange={e => handlePermissionChange(module.id, 'can_delete', e.target.checked)}
                      />
                    </td>
                    <td className="border px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={perm?.can_approve || false}
                        onChange={e => handlePermissionChange(module.id, 'can_approve', e.target.checked)}
                      />
                    </td>
                    <td className="border px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={perm?.can_release || false}
                        onChange={e => handlePermissionChange(module.id, 'can_release', e.target.checked)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">Please select a role to manage permissions</div>
      )}
    </div>
  )
}
