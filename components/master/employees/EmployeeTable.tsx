// components/master/employees/EmployeeTable.tsx
'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import SortButton from '@/components/ui/SortButton';
import SortIndicator from '@/components/ui/SortIndicator';

interface Employee {
  employee_id: string;
  full_name: string;
  job_position: string;
  branch_name: string;
  status_employee: string;
  email: string;
  join_date: string;
  mobile_phone?: string;
  profile_picture_url?: string | null;
}

interface EmployeeTableProps {
  employees: Employee[];
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
}

export default function EmployeeTable({ 
  employees, 
  sortConfig,
  onSort 
}: EmployeeTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Permanent':
        return 'bg-green-100 text-green-800';
      case 'Contract':
        return 'bg-yellow-100 text-yellow-800';
      case 'Part Time':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {onSort ? (
                  <SortButton
                    sortKey="full_name"
                    currentSort={sortConfig}
                    onSort={onSort}
                    className="font-medium"
                  >
                    Employee
                  </SortButton>
                ) : (
                  'Employee'
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {onSort ? (
                  <SortButton
                    sortKey="job_position"
                    currentSort={sortConfig}
                    onSort={onSort}
                    className="font-medium"
                  >
                    Position
                  </SortButton>
                ) : (
                  'Position'
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {onSort ? (
                  <SortButton
                    sortKey="branch_name"
                    currentSort={sortConfig}
                    onSort={onSort}
                    className="font-medium"
                  >
                    Branch
                  </SortButton>
                ) : (
                  'Branch'
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {onSort ? (
                  <SortButton
                    sortKey="status_employee"
                    currentSort={sortConfig}
                    onSort={onSort}
                    className="font-medium"
                  >
                    Status
                  </SortButton>
                ) : (
                  'Status'
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {onSort ? (
                  <SortButton
                    sortKey="join_date"
                    currentSort={sortConfig}
                    onSort={onSort}
                    className="font-medium"
                  >
                    Join Date
                  </SortButton>
                ) : (
                  'Join Date'
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee.employee_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Avatar 
                      src={employee.profile_picture_url} 
                      alt={employee.full_name}
                      size="sm"
                    />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {employee.full_name}
                        {sortConfig?.key === 'full_name' && (
                          <SortIndicator direction={sortConfig.direction} />
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {employee.employee_id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {employee.job_position}
                    {sortConfig?.key === 'job_position' && (
                      <SortIndicator direction={sortConfig.direction} />
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{employee.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {employee.branch_name}
                    {sortConfig?.key === 'branch_name' && (
                      <SortIndicator direction={sortConfig.direction} />
                    )}
                  </div>
                  {employee.mobile_phone && (
                    <div className="text-sm text-gray-500">{employee.mobile_phone}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.status_employee)}`}>
                    {employee.status_employee}
                    {sortConfig?.key === 'status_employee' && (
                      <SortIndicator direction={sortConfig.direction} />
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(employee.join_date)}
                  {sortConfig?.key === 'join_date' && (
                    <SortIndicator direction={sortConfig.direction} />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <Link
                      href={`/master/employees/${employee.employee_id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                    <Link
                      href={`/master/employees/${employee.employee_id}/edit`}
                      className="text-green-600 hover:text-green-900"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {employees.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No employees found
        </div>
      )}
    </div>
  );
}