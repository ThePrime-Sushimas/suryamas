'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import PaginationInfo from '@/components/ui/PaginationInfo';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  employee_id: string;
  employee_name: string;
  role_name: string;
  branch_name: string;
  is_active: boolean;
  last_login: string;
  created_at: string;
}

interface ApiResponse {
  users: User[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
  };
}

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [data, setData] = useState<ApiResponse>({
    users: [],
    pagination: {
      current_page: 1,
      total_pages: 0,
      total_count: 0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(Number(searchParams.get('limit')) || 10);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm
      });

      const response = await fetch(`/api/users?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const result = await response.json();
      setData(result);
      
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, itemsPerPage, searchTerm]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusToggle = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !currentStatus
        })
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">
            Manage system users and their access permissions
          </p>
        </div>
        <Link href="/master/users/create">
          <Button>
            Add New User
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by username, email, or employee name..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="animate-pulse">Loading users...</div>
                  </TableCell>
                </TableRow>
              ) : data.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                data.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.employee_name}</div>
                        <div className="text-sm text-gray-500">{user.employee_id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{user.role_name}</Badge>
                    </TableCell>
                    <TableCell>{user.branch_name}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'success' : 'error'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString('id-ID')
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/master/users/${user.id}`)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/master/users/${user.id}/permissions`)}
                        >
                          Permissions
                        </Button>
                        <Button
                          variant={user.is_active ? 'outline' : 'secondary'}
                          size="sm"
                          onClick={() => handleStatusToggle(user.id, user.is_active)}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {data.pagination.total_count > 0 && (
            <div className="mt-6 space-y-4">
              <PaginationInfo
                showingFrom={((currentPage - 1) * itemsPerPage) + 1}
                showingTo={Math.min(currentPage * itemsPerPage, data.pagination.total_count)}
                totalItems={data.pagination.total_count}
              />

              <Pagination
                currentPage={currentPage}
                totalPages={data.pagination.total_pages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={(newSize) => {
                  setItemsPerPage(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}