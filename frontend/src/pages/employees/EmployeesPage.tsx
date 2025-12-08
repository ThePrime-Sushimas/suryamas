import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeStore } from '../../stores/employeeStore'

export default function EmployeesPage() {
  const { employees, searchEmployees, deleteEmployee, isLoading } = useEmployeeStore()
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    searchEmployees('')
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      await searchEmployees(searchQuery)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete employee ${name}?`)) {
      await deleteEmployee(id)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        <button
          onClick={() => navigate('/employees/create')}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + Create Employee
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {employees.length > 0 ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Employee ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {employee.employee_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {employee.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {employee.job_position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {employee.branch_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleDelete(employee.id, employee.full_name)}
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
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          {searchQuery ? 'No employees found' : 'Search for employees to see results'}
        </div>
      )}
    </div>
  )
}
