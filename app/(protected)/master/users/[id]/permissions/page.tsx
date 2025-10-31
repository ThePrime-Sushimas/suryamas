'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { UserPermissionOverrideData, UserPermissionOverridesResponse } from '@/types/permissions';

export default function UserPermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<{ id: number; username: string; full_name: string; role_name: string } | null>(null);
  const [permissions, setPermissions] = useState<UserPermissionOverrideData[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [overrides, setOverrides] = useState<Map<number, 'granted' | 'revoked' | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUserPermissions = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedModule) params.set('module', selectedModule);

      // amazonq-ignore-next-line
      const response = await fetch(`/api/users/${userId}/permissions/overrides?${params}`);
      const data: UserPermissionOverridesResponse = await response.json();

      if (response.ok) {
        setUser(data.user);
        setPermissions(data.permissions);
        setModules(data.modules);
        
        // Set current overrides
        const currentOverrides = new Map();
        data.permissions.forEach(p => {
          if (p.override_status) {
            currentOverrides.set(p.id, p.override_status);
          }
        });
        setOverrides(currentOverrides);
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPermissions();
  }, [userId, selectedModule]);

  const handleOverrideChange = (permissionId: number, status: 'granted' | 'revoked' | null) => {
    const newOverrides = new Map(overrides);
    if (status === null) {
      newOverrides.delete(permissionId);
    } else {
      newOverrides.set(permissionId, status);
    }
    setOverrides(newOverrides);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const overrideData = Array.from(overrides.entries()).map(([permission_id, status]) => ({
        permission_id,
        is_granted: status === 'granted'
      }));

      const response = await fetch(`/api/users/${userId}/permissions/overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: overrideData })
      });

      if (response.ok) {
        // amazonq-ignore-next-line
        alert('Permission overrides berhasil disimpan');
        fetchUserPermissions();
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error saving overrides:', error);
      alert('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const getEffectivePermission = (permission: UserPermissionOverrideData) => {
    const override = overrides.get(permission.id);
    if (override === 'granted') return true;
    if (override === 'revoked') return false;
    return permission.has_role_permission;
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {} as Record<string, UserPermissionOverrideData[]>);

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
            Permission Overrides: {user?.full_name}
          </h1>
          <p className="text-gray-600">
            Role: <Badge variant="secondary">{user?.role_name}</Badge>
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Menyimpan...' : 'Simpan Overrides'}
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
        {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
          <div key={module} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">{module}</Badge>
              <span className="text-sm text-gray-600">
                ({modulePermissions.filter(p => getEffectivePermission(p)).length}/{modulePermissions.length} aktif)
              </span>
            </div>

            <div className="space-y-3">
              {modulePermissions.map(permission => {
                const currentOverride = overrides.get(permission.id);
                const effectivePermission = getEffectivePermission(permission);

                return (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{permission.permission_name}</div>
                      <div className="text-sm text-gray-600">{permission.permission_code}</div>
                      {permission.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {permission.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <div>Role: 
                          <Badge variant={permission.has_role_permission ? 'success' : 'error'} className="ml-1">
                            {permission.has_role_permission ? 'Ada' : 'Tidak'}
                          </Badge>
                        </div>
                        <div className="mt-1">Efektif: 
                          <Badge variant={effectivePermission ? 'success' : 'error'} className="ml-1">
                            {effectivePermission ? 'Ya' : 'Tidak'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={currentOverride === 'granted' ? 'primary' : 'outline'}
                          onClick={() => handleOverrideChange(permission.id, 
                            currentOverride === 'granted' ? null : 'granted'
                          )}
                        >
                          Grant
                        </Button>
                        <Button
                          size="sm"
                          variant={currentOverride === 'revoked' ? 'danger' : 'outline'}
                          onClick={() => handleOverrideChange(permission.id, 
                            currentOverride === 'revoked' ? null : 'revoked'
                          )}
                        >
                          Revoke
                        </Button>
                        {currentOverride && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOverrideChange(permission.id, null)}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(groupedPermissions).length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Tidak ada permissions ditemukan
        </div>
      )}
    </div>
  );
}