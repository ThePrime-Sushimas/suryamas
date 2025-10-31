'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface User {
  id: number;
  username: string;
  email: string;
  employee_id: string;
  employee_name: string;
  role_name: string;
  branch_name: string;
  is_active: boolean;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/users/${userId}`);
        // amazonq-ignore-next-line
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

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
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-2"
          >
            ← Kembali
          </Button>
          <h1 className="text-2xl font-bold">User Detail: {user.username}</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/master/users/${userId}/edit`)}
          >
            Edit User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <p className="mt-1 text-sm text-gray-900">{user.username}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee</label>
              <p className="mt-1 text-sm text-gray-900">{user.employee_name}</p>
              <p className="text-xs text-gray-500">{user.employee_id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <p className="mt-1 text-sm text-gray-900">{user.role_name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Branch</label>
              <p className="mt-1 text-sm text-gray-900">{user.branch_name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <p className={`mt-1 text-sm ${user.is_active ? 'text-green-600' : 'text-red-600'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}