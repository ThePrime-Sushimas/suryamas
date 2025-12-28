import type { EmployeeResponse } from '../types'

interface EmployeeTableProps {
  employees: EmployeeResponse[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onSort?: (field: string) => void
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  selectedIds?: string[]
  onSelect?: (id: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
}

export default function EmployeeTable({
  employees,
  onView,
  onEdit,
  onDelete,
  onSort,
  sortField,
  sortOrder,
  selectedIds = [],
  onSelect,
  onSelectAll
}: EmployeeTableProps) {
  const isSelected = (id: string) => selectedIds.includes(id)
  const isAllSelected = employees.length > 0 && employees.every(e => isSelected(e.id))

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>
    return sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelect && (
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  className="cursor-pointer"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('employee_id')}
            >
              Employee ID {onSort && <SortIcon field="employee_id" />}
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('full_name')}
            >
              Name {onSort && <SortIcon field="full_name" />}
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
              onClick={() => onSort?.('job_position')}
            >
              Position {onSort && <SortIcon field="job_position" />}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {employees.map((employee) => (
            <tr key={employee.id} className="hover:bg-gray-50">
              {onSelect && (
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  <input
                    type="checkbox"
                    checked={isSelected(employee.id)}
                    onChange={(e) => onSelect(employee.id, e.target.checked)}
                    className="cursor-pointer"
                  />
                </td>
              )}
              <td className="px-4 py-3 whitespace-nowrap">
                {employee.profile_picture ? (
                  <img
                    src={employee.profile_picture}
                    alt={employee.full_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                    {employee.full_name.charAt(0)}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.employee_id}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onView(employee.id)
                  }}
                  className="text-blue-600 hover:text-blue-900 hover:underline cursor-pointer"
                >
                  {employee.full_name}
                </button>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.job_position}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.branch_name || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.email || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.mobile_phone || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    employee.status_employee === 'Permanent'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {employee.status_employee}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    employee.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {employee.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                <button
                  type="button"
                  onClick={() => onView(employee.id)}
                  className="text-blue-600 hover:text-blue-900 mr-2"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(employee.id)}
                  className="text-green-600 hover:text-green-900 mr-2"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(employee.id, employee.full_name)}
                  className="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
