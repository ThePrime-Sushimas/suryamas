'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description: string;
  hierarchy_level: number;
  is_active: boolean;
}

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleId, setRoleId] = useState<string>('');
  const [formData, setFormData] = useState({
    role_code: '',
    role_name: '',
    description: '',
    hierarchy_level: 10,
    is_active: true
  });

  useEffect(() => {
    const initPage = async () => {
      const { id } = await params;
      setRoleId(id);
      fetchRole(id);
    };
    initPage();
  }, [params]);

  const fetchRole = async (id: string) => {
    try {
      const response = await fetch(`/api/roles/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRole(data.role);
        setFormData({
          role_code: data.role.role_code,
          role_name: data.role.role_name,
          description: data.role.description,
          hierarchy_level: data.role.hierarchy_level,
          is_active: data.role.is_active
        });
      }
    } catch (error) {
      console.error('Error fetching role:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        router.push('/master/roles?message=Role updated successfully');
      } else {
        alert('Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Error updating role');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!role) {
    return <div className="p-6">Role not found</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Edit Role</h1>
        <p className="text-gray-600 mt-2">Update role information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Role Code</label>
              <Input
                value={formData.role_code}
                onChange={(e) => setFormData({...formData, role_code: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Role Name</label>
              <Input
                value={formData.role_name}
                onChange={(e) => setFormData({...formData, role_name: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Hierarchy Level</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={formData.hierarchy_level}
                onChange={(e) => setFormData({...formData, hierarchy_level: parseInt(e.target.value)})}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              />
              <label htmlFor="is_active" className="text-sm font-medium">Active</label>
            </div>

            <div className="flex space-x-4 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Updating...' : 'Update Role'}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => router.push('/master/roles')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}