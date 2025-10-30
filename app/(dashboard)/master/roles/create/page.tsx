'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

interface FormData {
  role_code: string;
  role_name: string;
  description: string;
  hierarchy_level: number;
  is_active: boolean;
}

export default function CreateRolePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    role_code: '',
    role_name: '',
    description: '',
    hierarchy_level: 50,
    is_active: true
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.role_code) {
      newErrors.role_code = 'Role code is required';
    }

    if (!formData.role_name) {
      newErrors.role_name = 'Role name is required';
    }

    if (!formData.description) {
      newErrors.description = 'Description is required';
    }

    if (formData.hierarchy_level < 1 || formData.hierarchy_level > 100) {
      newErrors.hierarchy_level = 'Hierarchy level must be between 1-100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/master/roles?message=Role created successfully');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create role');
      }
    } catch (error) {
      console.error('Error creating role:', error);
      alert('Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Role</h1>
          <p className="text-gray-600 mt-2">
            Create a new system role with permissions
          </p>
        </div>
        <Link href="/master/roles">
          <Button variant="outline">
            Back to Roles
          </Button>
        </Link>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Role Information</CardTitle>
            <CardDescription>
              Fill in the basic information for the new role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Role Code *"
                    value={formData.role_code}
                    onChange={(e) => handleInputChange('role_code', e.target.value.toUpperCase())}
                    error={errors.role_code}
                    placeholder="e.g., CASHIER"
                  />
                </div>
                <div>
                  <Input
                    label="Role Name *"
                    value={formData.role_name}
                    onChange={(e) => handleInputChange('role_name', e.target.value)}
                    error={errors.role_name}
                    placeholder="e.g., Cashier"
                  />
                </div>
              </div>

              <div>
                <Input
                  label="Description *"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  error={errors.description}
                  placeholder="Describe the role responsibilities"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hierarchy Level * (1-100)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.hierarchy_level}
                  onChange={(e) => handleInputChange('hierarchy_level', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.hierarchy_level && (
                  <p className="text-red-600 text-sm mt-1">{errors.hierarchy_level}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Higher numbers = higher authority (1=lowest, 100=highest)
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Role is active
                </label>
              </div>

              <div className="flex space-x-4 pt-6 border-t">
                <Button
                  type="submit"
                  loading={loading}
                  disabled={loading}
                >
                  Create Role
                </Button>
                <Link href="/master/roles">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}