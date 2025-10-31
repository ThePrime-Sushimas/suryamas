// app/(dashboard)/master/users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useDebounce } from '@/hooks/useDebounce';

interface User {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  last_login: string;
  role: {
    role_name: string;
    role_code: string;
  };
  employee: {
    full_name: string;
    job_position: string;
  };
  branch: {
    nama_branch: string;
  };
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(debouncedSearch && { search: debouncedSearch })
      });

      // amazonq-ignore-next-line
      // amazonq-ignore-next-line
      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();

      // amazonq-ignore-next-line
      setUsers(data.users);
      setTotalPages(data.pagination.total_pages);
      setTotalCount(data.pagination.total_count);
    } catch (error) {
      // amazonq-ignore-next-line
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, debouncedSearch]);

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Users</h1>
              <p className="text-gray-600 mt-2">Manage system users and access</p>
            </div>
            <Link href="/master/users/create">
              <Button>Add User</Button>
            </Link>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Users ({totalCount})</h2>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.username}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.employee?.full_name}</div>
                          <div className="text-sm text-gray-500">{user.employee?.job_position}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="info">{user.role?.role_name}</Badge>
                      </TableCell>
                      <TableCell>{user.branch?.nama_branch || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'success' : 'error'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/master/users/${user.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                          <Link href={`/master/users/${user.id}/edit`}>
                            <Button variant="ghost" size="sm">Edit</Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
