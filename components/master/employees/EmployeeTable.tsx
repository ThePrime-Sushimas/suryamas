// components/master/employees/EmployeeTable.tsx
'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import SortButton from '@/components/ui/SortButton';
import SortIndicator from '@/components/ui/SortIndicator';
import { EmployeeStatus } from '@/types/employee';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface Employee {
  employee_id: string;
  full_name: string;
  job_position: string;
  branch_name: string;
  status_employee: EmployeeStatus;
  email: string;
  join_date: string;
  resign_date?: string | null;
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
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Jika mobile, render card view
  if (isMobile) {
    return <EmployeeTableMobile employees={employees} />;
  }

  // Desktop view (existing code)
  return <EmployeeTableDesktop employees={employees} sortConfig={sortConfig} onSort={onSort} />;
}

// Mobile Component
function EmployeeTableMobile({ employees }: { employees: Employee[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Permanent':
        return 'text-black-800';
      case 'Contract':
        return 'text-black-800';
      case 'Part Time':
        return 'text-black-800';
      case 'Resign':
        return 'text-black-800';
      default:
        return 'text-black-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="divide-y divide-gray-200">
        {employees.map((employee) => (
          <div key={employee.employee_id} className="p-4 hover:bg-gray-50">
            {/* Header dengan avatar dan info utama */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Avatar 
                  src={employee.profile_picture_url} 
                  alt={employee.full_name}
                  size="sm"
                />
                <div>
                  <Link 
                    href={`/master/employees/${employee.employee_id}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {employee.full_name}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">
                    {employee.employee_id}
                  </div>
                </div>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.status_employee)}`}>
                {employee.status_employee}
              </span>
            </div>

            {/* Detail informasi */}
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Position:</span>
                <span className="text-gray-900 font-medium">{employee.job_position}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Branch:</span>
                <span className="text-gray-900">{employee.branch_name}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Email:</span>
                <span className="text-gray-900 truncate max-w-[150px]">{employee.email}</span>
              </div>

              {employee.mobile_phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-900">{employee.mobile_phone}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-500">Join Date:</span>
                <span className="text-gray-900">{formatDate(employee.join_date)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {employees.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No employees found
        </div>
      )}
    </div>
  );
}

// Desktop Component (existing code dipindah ke sini)
function EmployeeTableDesktop({ 
  employees, 
  sortConfig,
  onSort 
}: EmployeeTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Permanent':
        return 'text-black-800';
      case 'Contract':
        return 'text-black-800';
      case 'Part Time':
        return 'text-black-800';
      case 'Resign':
        return 'text-black-800';
      default:
        return 'text-black-800';  
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
            {employees.map((employee) => {
              return (
                <tr key={employee.employee_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Avatar 
                        src={employee.profile_picture_url} 
                        alt={employee.full_name}
                        size="sm"
                      />
                      <div className="ml-4">
                        <Link 
                          href={`/master/employees/${employee.employee_id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                        >
                          {employee.full_name}
                          {sortConfig?.key === 'full_name' && (
                            <SortIndicator direction={sortConfig.direction} />
                          )}
                        </Link>                        
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
                    <Link 
                      href={`/master/employees/${employee.employee_id}/edit`}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </Link>
                    <Link 
                      href={`/master/employees/${employee.employee_id}`}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
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