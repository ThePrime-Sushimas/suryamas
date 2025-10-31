'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Permission, PermissionFormData, PermissionsResponse } from '@/types/permissions';

export default function PermissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedModule, setSelectedModule] = useState(searchParams.get('module') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [formData, setFormData] = useState<PermissionFormData>({
    permission_code: '',
    permission_name: '',
    module: '',
    table_name: '',
    description: ''
  });
  const [selectedCrudAction, setSelectedCrudAction] = useState<string>('');

  const fetchPermissions = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(selectedModule && { module: selectedModule })
      });

      const response = await fetch(`/api/permissions?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }
      
      const data: PermissionsResponse = await response.json();
      setPermissions(data.permissions || []);
      setModules(data.modules || []);
      setTotalPages(data.pagination?.totalPages || 1);
      
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
      setModules([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const updateURL = (params: Record<string, string | number | null>) => {
    const url = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.set(key, value.toString());
      } else {
        url.delete(key);
      }
    });
    
    router.push(`?${url.toString()}`, { scroll: false });
  };

  useEffect(() => {
    fetchPermissions();
    fetchTables();
  }, [page, search, selectedModule]);

  useEffect(() => {
    updateURL({
      page: page > 1 ? page : null,
      search: search || null,
      module: selectedModule || null
    });
  }, [page, search, selectedModule]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedModule]);

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/permissions/tables');
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPermission) {
        // Edit single permission
        const response = await fetch(`/api/permissions/${editingPermission.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (!response.ok) {
          const error = await response.json();
          alert(error.error);
          return;
        }
      } else if (selectedCrudAction && formData.table_name) {
        // Create single permission for selected CRUD action
        const permission = {
          permission_code: `${formData.table_name}.${selectedCrudAction}`,
          permission_name: `${selectedCrudAction.charAt(0).toUpperCase() + selectedCrudAction.slice(1)} ${formData.table_name}`,
          module: formData.module || `${formData.table_name} Management`,
          table_name: formData.table_name,
          description: `Can ${selectedCrudAction} ${formData.table_name} records`
        };

        const response = await fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(permission)
        });

        if (!response.ok) {
          const error = await response.json();
          alert(`Error creating ${permission.permission_code}: ${error.error}`);
          return;
        }
      } else {
        // Create single permission
        const response = await fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (!response.ok) {
          const error = await response.json();
          alert(error.error);
          return;
        }
      }

      setShowModal(false);
      setEditingPermission(null);
      setFormData({
        permission_code: '',
        permission_name: '',
        module: '',
        table_name: '',
        description: ''
      });
      setSelectedCrudAction('');
      fetchPermissions();
      
    } catch (error) {
      console.error('Error saving permission:', error);
      alert('Terjadi kesalahan');
    }
  };

  const handleEdit = (permission: Permission) => {
    setEditingPermission(permission);
    setFormData({
      permission_code: permission.permission_code,
      permission_name: permission.permission_name,
      module: permission.module,
      table_name: permission.table_name || '',
      description: permission.description || ''
    });
    
    // Auto-detect CRUD action from permission_code
    let detectedAction = '';
    if (permission.table_name && permission.permission_code.includes('.')) {
      const action = permission.permission_code.split('.').pop();
      if (['view', 'create', 'edit', 'delete'].includes(action || '')) {
        detectedAction = action || '';
      }
    }
    setSelectedCrudAction(detectedAction);
    
    setShowModal(true);
  };

  const handleDelete = async (permission: Permission) => {
    if (!confirm(`Hapus permission "${permission.permission_name}"?`)) return;

    try {
      const response = await fetch(`/api/permissions/${permission.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchPermissions();
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          alert(error.error);
        } else {
          alert('Terjadi kesalahan pada server');
        }
      }
    } catch (error) {
      console.error('Error deleting permission:', error);
      alert('Terjadi kesalahan');
    }
  };

  const columns = [
    { key: 'permission_code', label: 'Kode' },
    { key: 'permission_name', label: 'Nama Permission' },
    { 
      key: 'module', 
      label: 'Modul',
      render: (value: string) => <Badge variant="default">{value}</Badge>
    },
    { 
      key: 'table_name', 
      label: 'Tabel',
      render: (value: string) => value ? <Badge variant="secondary">{value}</Badge> : '-'
    },
    { key: 'description', label: 'Deskripsi' },
    {
      key: 'actions',
      label: 'Aksi',
      render: (_: any, permission: Permission) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(permission)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(permission)}
          >
            Hapus
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manajemen Permissions</h1>
        <Button onClick={() => setShowModal(true)}>
          Tambah Permission
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Cari permission..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <select
          value={selectedModule}
          onChange={(e) => {
            setSelectedModule(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">Semua Modul</option>
          {modules.map(module => (
            <option key={module} value={module}>{module}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(column => (
                <th key={column.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {permissions.map(permission => (
              <tr key={permission.id} className="hover:bg-gray-50">
                {columns.map(column => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {column.render ? column.render(permission[column.key as keyof Permission] as any, permission) : permission[column.key as keyof Permission]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingPermission(null);
          setFormData({
            permission_code: '',
            permission_name: '',
            module: '',
            table_name: '',
            description: ''
          });
          setSelectedCrudAction('');
        }}
        title={editingPermission ? 'Edit Permission' : 'Tambah Permission'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Kode Permission"
            value={formData.permission_code}
            onChange={(e) => setFormData(prev => ({ ...prev, permission_code: e.target.value }))}
            required
          />
          <Input
            label="Nama Permission"
            value={formData.permission_name}
            onChange={(e) => setFormData(prev => ({ ...prev, permission_name: e.target.value }))}
            required
          />
          <Input
            label="Modul"
            value={formData.module}
            onChange={(e) => setFormData(prev => ({ ...prev, module: e.target.value }))}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nama Tabel
            </label>
            <select
              value={formData.table_name}
              onChange={(e) => {
                const tableName = e.target.value;
                setFormData(prev => ({ ...prev, table_name: tableName }));
                if (tableName) {
                  setFormData(prev => ({ ...prev, module: `${tableName} Management` }));
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih Tabel</option>
              {tables.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          {formData.table_name && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CRUD Action untuk {formData.table_name}
              </label>
              <select
                value={selectedCrudAction}
                onChange={(e) => setSelectedCrudAction(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih Action</option>
                <option value="view">View/Read - Can view records</option>
                <option value="create">Create - Can add new records</option>
                <option value="edit">Edit/Update - Can modify records</option>
                <option value="delete">Delete - Can remove records</option>
              </select>
              {selectedCrudAction && (
                <p className="text-xs text-gray-500 mt-2">
                  Will create: {formData.table_name}.{selectedCrudAction}
                </p>
              )}
            </div>
          )}
          <Input
            label="Deskripsi"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
          <div className="flex gap-2 pt-4">
            <Button type="submit">
              {editingPermission ? 'Update' : 'Simpan'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Batal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}