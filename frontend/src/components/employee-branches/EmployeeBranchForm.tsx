import { useState } from 'react'
import { X, Search, Star } from 'lucide-react'
import type { CreateEmployeeBranchDto } from '@/types/employeeBranch'

interface EmployeeBranchFormProps {
  employees: Array<{ id: string; full_name: string }>
  branches: Array<{ id: string; branch_name: string; branch_code: string }>
  onSubmit: (data: CreateEmployeeBranchDto[]) => void
  onCancel: () => void
  loading?: boolean
  loadingData?: boolean
}

export function EmployeeBranchForm({
  employees,
  branches,
  onSubmit,
  onCancel,
  loading,
  loadingData
}: EmployeeBranchFormProps) {
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [showEmployeeList, setShowEmployeeList] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; full_name: string } | null>(null)
  const [primaryBranch, setPrimaryBranch] = useState<string>('')
  const [secondaryBranches, setSecondaryBranches] = useState<Set<string>>(new Set())

  const filteredEmployees = showEmployeeList && Array.isArray(employees)
    ? employees.filter(emp =>
        emp.full_name.toLowerCase().includes(employeeSearch.toLowerCase())
      )
    : []

  const handleSelectEmployee = (emp: { id: string; full_name: string }) => {
    setSelectedEmployee(emp)
    setShowEmployeeList(false)
    setEmployeeSearch('')
  }

  const handleToggleSecondary = (branchId: string) => {
    const newSelected = new Set(secondaryBranches)
    if (newSelected.has(branchId)) {
      newSelected.delete(branchId)
    } else {
      newSelected.add(branchId)
    }
    setSecondaryBranches(newSelected)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee || !primaryBranch) {
      alert('Please select employee and primary branch')
      return
    }

    const assignments: CreateEmployeeBranchDto[] = [
      {
        employee_id: selectedEmployee.id,
        branch_id: primaryBranch,
        is_primary: true
      }
    ]

    secondaryBranches.forEach(branchId => {
      assignments.push({
        employee_id: selectedEmployee.id,
        branch_id: branchId,
        is_primary: false
      })
    })

    onSubmit(assignments)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Assign Employee to Branches</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {loadingData ? (
            <div className="text-center py-4 text-gray-500">Loading data...</div>
          ) : (
            <>
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Employee</label>
                <div className="relative">
                  <div className="flex items-center border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                    <Search size={16} className="text-gray-400 mr-2" />
                    <input
                      type="text"
                      placeholder="Search employee..."
                      value={showEmployeeList ? employeeSearch : selectedEmployee?.full_name || ''}
                      onChange={(e) => {
                        setEmployeeSearch(e.target.value)
                        setShowEmployeeList(true)
                      }}
                      onFocus={() => setShowEmployeeList(true)}
                      className="flex-1 outline-none text-sm"
                      required
                    />
                  </div>
                  {showEmployeeList && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {Array.isArray(employees) && filteredEmployees.length > 0 ? (
                        filteredEmployees.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => handleSelectEmployee(emp)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                          >
                            {emp.full_name}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">No employees found</div>
                      )}
                    </div>
                  )}
                </div>
                {selectedEmployee && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-900">
                    Selected: <strong>{selectedEmployee.full_name}</strong>
                  </div>
                )}
              </div>

              {/* Primary Branch Selection */}
              <div>
                <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                  <Star size={16} className="text-yellow-500" fill="currentColor" />
                  Primary Branch (Required)
                </label>
                <div className="space-y-2 border rounded-lg p-4 bg-yellow-50">
                  {Array.isArray(branches) && branches.length > 0 ? (
                    branches.map((branch) => (
                      <div key={branch.id} className="flex items-center gap-3 p-2 hover:bg-white rounded">
                        <input
                          type="radio"
                          id={`primary-${branch.id}`}
                          name="primary"
                          value={branch.id}
                          checked={primaryBranch === branch.id}
                          onChange={(e) => setPrimaryBranch(e.target.value)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor={`primary-${branch.id}`} className="flex-1 cursor-pointer text-sm">
                          <div className="font-medium">{branch.branch_name}</div>
                          <div className="text-xs text-gray-500">{branch.branch_code}</div>
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No branches available</div>
                  )}
                </div>
              </div>

              {/* Secondary Branches Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Additional Branches (Optional)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                  {Array.isArray(branches) && branches.length > 0 ? (
                    branches
                      .filter(b => b.id !== primaryBranch)
                      .map((branch) => (
                        <div key={branch.id} className="flex items-center gap-3 p-2 hover:bg-white rounded">
                          <input
                            type="checkbox"
                            id={`secondary-${branch.id}`}
                            checked={secondaryBranches.has(branch.id)}
                            onChange={() => handleToggleSecondary(branch.id)}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                          <label htmlFor={`secondary-${branch.id}`} className="flex-1 cursor-pointer text-sm">
                            <div className="font-medium">{branch.branch_name}</div>
                            <div className="text-xs text-gray-500">{branch.branch_code}</div>
                          </label>
                        </div>
                      ))
                  ) : (
                    <div className="text-sm text-gray-500">No branches available</div>
                  )}
                </div>
                {secondaryBranches.size > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-900">
                    Selected: <strong>{secondaryBranches.size} additional branch{secondaryBranches.size !== 1 ? 'es' : ''}</strong>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedEmployee || !primaryBranch}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Assigning...' : `Assign (1 Primary + ${secondaryBranches.size} Additional)`}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
