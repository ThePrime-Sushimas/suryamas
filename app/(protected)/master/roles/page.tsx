'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import PaginationInfo from '@/components/ui/PaginationInfo';
import Link from 'next/link';

interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description: string;
  hierarchy_level: number;
  is_active: boolean;
  user_count: number;
  created_at: string;
}

export default function RolesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(Number(searchParams.get('limit')) || 10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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

  const fetchRoles = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        ...(search && { search })
      });

      const response = await fetch(`/api/roles?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalCount(data.pagination?.totalCount || 0);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roleId: number) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    setDeleting(roleId);
    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setRoles(roles.filter(role => role.id !== roleId));
      } else {
        alert('Failed to delete role');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Error deleting role');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [page, itemsPerPage, search]);

  useEffect(() => {
    updateURL({
      page: page > 1 ? page : null,
      limit: itemsPerPage !== 10 ? itemsPerPage : null,
      search: search || null
    });
  }, [page, itemsPerPage, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const getHierarchyColor = (level: number) => {
    if (level >= 90) return 'error';
    if (level >= 70) return 'warning';
    if (level >= 50) return 'info';
    return 'success';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
          <p className="text-gray-600 mt-2">
            Manage system roles and their hierarchy
          </p>
        </div>
        <Link href="/master/roles/create">
          <Button>
            Create New Role
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Roles</CardTitle>
          <div className="mt-4">
            <Input
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Code</TableHead>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Hierarchy Level</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-pulse">Loading roles...</div>
                  </TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No roles found
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-mono">{role.role_code}</TableCell>
                    <TableCell className="font-medium">{role.role_name}</TableCell>
                    <TableCell className="max-w-xs truncate">{role.description}</TableCell>
                    <TableCell>
                      <Badge variant={getHierarchyColor(role.hierarchy_level)}>
                        Level {role.hierarchy_level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {role.user_count} users
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.is_active ? 'success' : 'error'}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Link href={`/master/roles/${role.id}/edit`}>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/master/roles/${role.id}/permissions`}>
                          <Button variant="outline" size="sm">
                            Permissions
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDelete(role.id)}
                          disabled={deleting === role.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          {deleting === role.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Section */}
      {(totalCount > 0 || search) && (
        <div className="space-y-4">
          <PaginationInfo
            showingFrom={totalCount === 0 ? 0 : ((page - 1) * itemsPerPage) + 1}
            showingTo={Math.min(page * itemsPerPage, totalCount)}
            totalItems={totalCount}
          />

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setPage(1);
            }}
          />
        </div>
      )}

    </div>
  );
}
