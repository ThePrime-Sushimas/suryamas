'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Permission, RolePermissionsResponse } from '@/types/permissions';

export default function RolePermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = params.id as string;

  const [role, setRole] = useState<{ id: number; role_name: string } | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRolePermissions = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedModule) params.set('module', selectedModule);

      const response = await fetch(`/api/roles/${roleId}/permissions?${params}`);
      const data: RolePermissionsResponse = await response.json();

      if (response.ok) {
        setRole(data.role);
        setPermissions(data.permissions);
        setModules(data.modules);
        
        // Set initially selected permissions
        const assigned = new Set(
          data.permissions
            .filter(p => p.is_assigned)
            .map(p => p.id)
        );
        setSelectedPermissions(assigned);
      }
    } catch (error) {
      console.error('Error fetching role permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolePermissions();
  }, [roleId, selectedModule]);

  const handlePermissionToggle = (permissionId: number) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSelectAll = (module: string) => {
    const modulePermissions = permissions.filter(p => p.module === module);
    const allSelected = modulePermissions.every(p => selectedPermissions.has(p.id));
    
    const newSelected = new Set(selectedPermissions);
    modulePermissions.forEach(p => {
      if (allSelected) {
        newSelected.delete(p.id);
      } else {
        newSelected.add(p.id);
      }
    });
    setSelectedPermissions(newSelected);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/roles/${roleId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission_ids: Array.from(selectedPermissions)
        })
      });

      if (response.ok) {
        alert('Permissions berhasil disimpan');
        fetchRolePermissions();
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-2"
          >
            ← Kembali
          </Button>
          <h1 className="text-2xl font-bold">
            Permissions untuk Role: {role?.role_name}
          </h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Menyimpan...' : 'Simpan Permissions'}
        </Button>
      </div>

      <div className="mb-6">
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">Semua Modul</option>
          {modules.map(module => (
            <option key={module} value={module}>{module}</option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedPermissions).map(([module, modulePermissions]) => {
          const allSelected = modulePermissions.every(p => selectedPermissions.has(p.id));
          const someSelected = modulePermissions.some(p => selectedPermissions.has(p.id));

          return (
            <div key={module} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{module}</Badge>
                  <span className="text-sm text-gray-600">
                    ({modulePermissions.filter(p => selectedPermissions.has(p.id)).length}/{modulePermissions.length} dipilih)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelectAll(module)}
                >
                  {allSelected ? 'Hapus Semua' : 'Pilih Semua'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {modulePermissions.map(permission => (
                  <label
                    key={permission.id}
                    className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.has(permission.id)}
                      onChange={() => handlePermissionToggle(permission.id)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{permission.permission_name}</div>
                      <div className="text-sm text-gray-600">{permission.permission_code}</div>
                      {permission.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {permission.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(groupedPermissions).length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Tidak ada permissions ditemukan
        </div>
      )}
    </div>
  );
}