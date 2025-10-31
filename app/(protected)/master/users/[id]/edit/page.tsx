'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  employee_id: string;
  employee_name: string;
  role_id: number;
  role_name: string;
  primary_branch_id: number;
  primary_branch_name: string;
  // amazonq-ignore-next-line
  additional_branches: { id: number; name: string }[];
  is_active: boolean;
}

interface Role {
  id: number;
  role_name: string;
}

interface Branch {
  // amazonq-ignore-next-line
  id_branch: number;
  nama_branch: string;
  kota: string;
}

export default function UserEditPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role_id: '',
    primary_branch_id: '',
    additional_branch_ids: [] as number[],
    is_active: true
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user data
        const userResponse = await fetch(`/api/users/${userId}`);
        // amazonq-ignore-next-line
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
          setFormData({
            username: userData.username,
            email: userData.email,
            role_id: userData.role_id?.toString() || '',
            primary_branch_id: userData.primary_branch_id?.toString() || '',
            additional_branch_ids: userData.additional_branches?.map((b: any) => b.id) || [],
            is_active: userData.is_active
          });
        }

        // Fetch roles
        const rolesResponse = await fetch('/api/roles');
        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json();
          setRoles(rolesData.roles);
        }

        // Fetch branches
        const branchesResponse = await fetch('/api/branches?is_active=true');
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          setBranches(branchesData.branches);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          // amazonq-ignore-next-line
          role_id: parseInt(formData.role_id),
          primary_branch_id: parseInt(formData.primary_branch_id),
          additional_branch_ids: formData.additional_branch_ids,
          is_active: formData.is_active
        })
      });

      if (response.ok) {
        // amazonq-ignore-next-line
        alert('User berhasil diupdate');
        router.push('/master/users');
      } else {
        const error = await response.json();
        alert(error.error || 'Gagal mengupdate user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  if (!user) {
    return <div className="p-6">User not found</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/master/users">
            <Button variant="outline" className="mb-2">
              ← Kembali
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Edit User: {user.username}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit User Information</CardTitle>
          <CardDescription>
            Update user account details and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                required
              />
              
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee
              </label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{user.employee_name}</p>
                <p className="text-sm text-gray-600">{user.employee_id}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, role_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Branch *
                </label>
                <select
                  value={formData.primary_branch_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_branch_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Primary Branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id_branch} value={branch.id_branch}>
                      {branch.nama_branch} - {branch.kota}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Additional Branches (Optional)
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                {branches
                  .filter(branch => branch.id_branch.toString() !== formData.primary_branch_id)
                  .map((branch) => (
                    <label key={branch.id_branch} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.additional_branch_ids.includes(branch.id_branch)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              additional_branch_ids: [...prev.additional_branch_ids, branch.id_branch]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              additional_branch_ids: prev.additional_branch_ids.filter(id => id !== branch.id_branch)
                            }));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                      />
                      <span className="text-sm">{branch.nama_branch} - {branch.kota}</span>
                    </label>
                  ))
                }
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Account is active</span>
              </label>
            </div>

            {/* Preview Section */}
            {(formData.primary_branch_id || formData.additional_branch_ids.length > 0) && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Branch Assignment Preview:</h4>
                {formData.primary_branch_id && (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Primary:</span> {branches.find(b => b.id_branch.toString() === formData.primary_branch_id)?.nama_branch}
                  </p>
                )}
                {formData.additional_branch_ids.length > 0 && (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Additional:</span> {formData.additional_branch_ids.map(id => branches.find(b => b.id_branch === id)?.nama_branch).join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button type="submit" disabled={saving || !formData.primary_branch_id}>
                {saving ? 'Menyimpan...' : 'Update User'}
              </Button>
              <Link href="/master/users">
                <Button type="button" variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}