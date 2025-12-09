import { useNavigate } from 'react-router-dom'

interface Employee {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  branch_name: string
  email: string | null
  mobile_phone: string | null
  status_employee: string
  is_active: boolean
  profile_picture: string | null
}

interface EmployeeCardProps {
  employee: Employee
  onDelete: (id: string, name: string) => void
  isSelected: boolean
  onSelect: (id: string, checked: boolean) => void
}

export default function EmployeeCard({ employee, onDelete, isSelected, onSelect }: EmployeeCardProps) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(employee.id, e.target.checked)}
          className="mt-1 min-w-[16px] min-h-[16px]"
        />
        {employee.profile_picture ? (
          <img src={employee.profile_picture} alt={employee.full_name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
            {employee.full_name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate(`/employees/${employee.id}`)}
            className="text-blue-600 font-medium text-base hover:underline text-left"
          >
            {employee.full_name}
          </button>
          <p className="text-sm text-gray-600">{employee.employee_id}</p>
          <p className="text-sm text-gray-600">{employee.job_position}</p>
          <p className="text-sm text-gray-500">{employee.branch_name}</p>
          {employee.email && <p className="text-sm text-gray-500">{employee.email}</p>}
          {employee.mobile_phone && <p className="text-sm text-gray-500">{employee.mobile_phone}</p>}
          <div className="flex gap-2 mt-2">
            <span className={`px-2 py-1 rounded-full text-xs ${employee.status_employee === 'Permanent' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {employee.status_employee}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {employee.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex gap-3 mt-3">
            <button onClick={() => navigate(`/employees/${employee.id}`)} className="text-blue-600 text-sm font-medium min-h-[44px] px-3">
              View
            </button>
            <button onClick={() => onDelete(employee.id, employee.full_name)} className="text-red-600 text-sm font-medium min-h-[44px] px-3">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
