'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

interface Permission {
  id: number;
  permission_code: string;
  permission_name: string;
  description: string;
  module: string;
  action: string;
  role_count: number;
  created_at: string;
}

interface GroupedPermissions {
  [module: string]: Permission[];
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/permissions');
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const groupByModule = (perms: Permission[]): GroupedPermissions => {
    return perms.reduce((groups, permission) => {
      const module = permission.module;
      if (!groups[module]) {
        groups[module] = [];
      }
      groups[module].push(permission);
      return groups;
    }, {} as GroupedPermissions);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'success';
      case 'READ': return 'info';
      case 'UPDATE': return 'warning';
      case 'DELETE': return 'error';
      case 'EXPORT': return 'default';
      default: return 'default';
    }
  };

  const getModuleColor = (module: string) => {
    switch (module) {
      case 'MASTER': return 'info';
      case 'TRANSACTION': return 'success';
      case 'REPORT': return 'warning';
      case 'SYSTEM': return 'error';
      default: return 'default';
    }
  };

  const groupedPermissions = groupByModule(permissions);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permissions Management</h1>
          <p className="text-gray-600 mt-2">
            View system permissions and their assignments
          </p>
        </div>
      </div>

      {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
        <Card key={module}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Badge variant={getModuleColor(module)}>
                {module}
              </Badge>
              <span>{module} Permissions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission Code</TableHead>
                  <TableHead>Permission Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Assigned to Roles</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modulePermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell className="font-mono text-sm">
                      {permission.permission_code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {permission.permission_name}
                    </TableCell>
                    <TableCell className="max-w-md">
                      {permission.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionColor(permission.action)}>
                        {permission.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {permission.role_count} roles
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(permission.created_at).toLocaleDateString('id-ID')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {!loading && permissions.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              No permissions found
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}