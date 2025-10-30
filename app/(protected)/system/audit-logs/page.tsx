'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import PaginationInfo from '@/components/ui/PaginationInfo';

interface AuditLog {
  id: number;
  user_name: string;
  employee_name: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: any;
  new_values: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface ApiResponse {
  logs: AuditLog[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
  };
}

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  
  const [data, setData] = useState<ApiResponse>({
    logs: [],
    pagination: {
      current_page: 1,
      total_pages: 0,
      total_count: 0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(Number(searchParams.get('limit')) || 20);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm
      });

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const result = await response.json();
      setData(result);
      
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, itemsPerPage, searchTerm]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'success';
      case 'UPDATE': return 'warning';
      case 'DELETE': return 'error';
      case 'LOGIN': return 'info';
      default: return 'default';
    }
  };

  const formatJson = (data: any) => {
    if (!data) return '-';
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-2">
            System activity and change history
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex space-x-4">
            <Input
              placeholder="Search by user, action, or table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Button onClick={fetchLogs} variant="outline">
              Refresh
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-pulse">Loading audit logs...</div>
                  </TableCell>
                </TableRow>
              ) : data.logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                data.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.user_name}</div>
                        <div className="text-sm text-gray-500">{log.employee_name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.table_name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.record_id}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <details className="cursor-pointer">
                        <summary className="text-sm text-blue-600 hover:text-blue-800">
                          View Changes
                        </summary>
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono">
                          <div><strong>Old Values:</strong></div>
                          <pre>{formatJson(log.old_values)}</pre>
                          <div className="mt-2"><strong>New Values:</strong></div>
                          <pre>{formatJson(log.new_values)}</pre>
                        </div>
                      </details>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.ip_address}
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