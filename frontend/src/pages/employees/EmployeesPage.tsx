import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeStore } from '../../stores/employeeStore'
import ExportButton from '../../components/ExportButton'
import ImportModal from '../../components/ImportModal'
import BulkActionBar from '../../components/BulkActionBar'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import { useUrlState } from '../../hooks/useUrlState'

export default function EmployeesPage() {
  const { employees, searchEmployees, deleteEmployee, bulkUpdateActive, bulkDelete, filterOptions, fetchFilterOptions, pagination, isLoading } = useEmployeeStore()
  const { selectedIds, selectAll, selectOne, clearSelection, isSelected, isAllSelected, selectedCount } = useBulkSelection(employees)
  const navigate = useNavigate()
  
  const { state, setState } = useUrlState({
    page: '1',
    limit: '10',
    sort: 'created_at',
    order: 'desc',
    search: '',
    branch_name: '',
    is_active: '',
    status_employee: '',
    job_position: '',
    showImport: '',
    selectedImage: '',
  })

  useEffect(() => {
    fetchFilterOptions()
    handleFetch()
  }, [state.page, state.limit, state.sort, state.order, state.search, state.branch_name, state.is_active, state.status_employee, state.job_position])

  const handleFetch = () => {
    const filters: any = {}
    if (state.branch_name) filters.branch_name = state.branch_name
    if (state.is_active) filters.is_active = state.is_active
    if (state.status_employee) filters.status_employee = state.status_employee
    if (state.job_position) filters.job_position = state.job_position
    
    searchEmployees(state.search, state.sort, state.order as 'asc' | 'desc', filters, Number(state.page), Number(state.limit))
  }

  const getActiveFilters = () => {
    const filters: any = {}
    if (state.branch_name) filters.branch_name = state.branch_name
    if (state.is_active) filters.is_active = state.is_active
    if (state.status_employee) filters.status_employee = state.status_employee
    if (state.job_position) filters.job_position = state.job_position
    return filters
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setState({ page: '1' })
  }

  const handleClearSearch = () => {
    setState({ search: '', page: '1' })
  }

  const handleSort = (field: string) => {
    const newOrder = state.sort === field && state.order === 'asc' ? 'desc' : 'asc'
    setState({ sort: field, order: newOrder, page: '1' })
  }

  const handleFilterChange = (key: string, value: string) => {
    setState({ [key]: value, page: '1' })
  }

  const handleClearFilters = () => {
    setState({ branch_name: '', is_active: '', status_employee: '', job_position: '', page: '1' })
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (state.sort !== field) return <span className="text-gray-400">⇅</span>
    return state.order === 'asc' ? <span>↑</span> : <span>↓</span>
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete employee ${name}?`)) {
      await deleteEmployee(id)
      handleFetch()
    }
  }

  const handleBulkUpdateActive = async (isActive: boolean) => {
    if (confirm(`Set ${selectedCount} employees to ${isActive ? 'Active' : 'Inactive'}?`)) {
      await bulkUpdateActive(selectedIds, isActive)
      clearSelection()
      handleFetch()
    }
  }

  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedCount} employees?`)) {
      await bulkDelete(selectedIds)
      clearSelection()
      handleFetch()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        <div className="flex gap-2">
          <BulkActionBar
            selectedCount={selectedCount}
            actions={[
              { label: 'Set Active', onClick: () => handleBulkUpdateActive(true), className: 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700' },
              { label: 'Set Inactive', onClick: () => handleBulkUpdateActive(false), className: 'px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700' },
              { label: 'Delete', onClick: handleBulkDelete, className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700' },
            ]}
          />
          <ExportButton endpoint="/employees" filename="employees" filter={getActiveFilters()} />
          <button
            onClick={() => setState({ showImport: 'true' })}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Import Excel
          </button>
          <button
            onClick={() => navigate('/employees/create')}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + Create Employee
          </button>
        </div>
      </div>

      <ImportModal 
        isOpen={state.showImport === 'true'} 
        onClose={() => setState({ showImport: '' })}
        onSuccess={() => { setState({ showImport: '' }); handleFetch() }}
        endpoint="/employees"
        title="Employees"
      />

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search employees..."
              value={state.search}
              onChange={(e) => setState({ search: e.target.value })}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
            {state.search && (
              <button
                type="button"
                onClick={handleClearSearch}
                disabled={isLoading}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex gap-3 items-center">
            <span className="text-sm font-medium text-gray-700">Filters:</span>
            <select
              value={state.branch_name}
              onChange={(e) => handleFilterChange('branch_name', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {filterOptions?.branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
            <select
              value={state.status_employee}
              onChange={(e) => handleFilterChange('status_employee', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              {filterOptions?.statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              value={state.is_active}
              onChange={(e) => handleFilterChange('is_active', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Active Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select
              value={state.job_position}
              onChange={(e) => handleFilterChange('job_position', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Positions</option>
              {filterOptions?.positions.map(position => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
            {(state.branch_name || state.is_active || state.status_employee || state.job_position) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </form>
      </div>

      {state.selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setState({ selectedImage: '' })}
        >
          <div className="relative w-1/2 p-4">
            <img 
              src={state.selectedImage} 
              alt="Preview" 
              className="w-full h-auto object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setState({ selectedImage: '' })}
              className="absolute top-6 right-6 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {employees.length > 0 ? (
        <>
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  <input type="checkbox" checked={isAllSelected} onChange={(e) => selectAll(e.target.checked)} className="cursor-pointer" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Photo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('employee_id')}>Employee ID <SortIcon field="employee_id" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('full_name')}>Name <SortIcon field="full_name" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('job_position')}>Position <SortIcon field="job_position" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('branch_name')}>Branch <SortIcon field="branch_name" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('parent_branch_name')}>Parent Branch <SortIcon field="parent_branch_name" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('email')}>Email <SortIcon field="email" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('mobile_phone')}>Phone <SortIcon field="mobile_phone" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nik')}>NIK <SortIcon field="nik" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('birth_date')}>Birth Date <SortIcon field="birth_date" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('birth_place')}>Birth Place <SortIcon field="birth_place" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('age')}>Age <SortIcon field="age" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('gender')}>Gender <SortIcon field="gender" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('religion')}>Religion <SortIcon field="religion" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('marital_status')}>Marital Status <SortIcon field="marital_status" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('join_date')}>Join Date <SortIcon field="join_date" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('resign_date')}>Resign Date <SortIcon field="resign_date" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('sign_date')}>Sign Date <SortIcon field="sign_date" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('end_date')}>End Date <SortIcon field="end_date" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status_employee')}>Status <SortIcon field="status_employee" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('is_active')}>Active <SortIcon field="is_active" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('ptkp_status')}>PTKP <SortIcon field="ptkp_status" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('bank_name')}>Bank Name <SortIcon field="bank_name" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('bank_account')}>Bank Account <SortIcon field="bank_account" /></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('bank_account_holder')}>Bank Holder <SortIcon field="bank_account_holder" /></th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <input type="checkbox" checked={isSelected(employee.id)} onChange={(e) => selectOne(employee.id, e.target.checked)} className="cursor-pointer" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {employee.profile_picture ? (
                      <img 
                        src={employee.profile_picture} 
                        alt={employee.full_name} 
                        className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80" 
                        onClick={() => setState({ selectedImage: employee.profile_picture || '' })}
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
                      onClick={() => navigate(`/employees/${employee.id}`)}
                      className="text-blue-600 hover:text-blue-900 hover:underline"
                    >
                      {employee.full_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.job_position}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.branch_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.parent_branch_name || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.email || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.mobile_phone || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.nik || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.birth_date ? new Date(employee.birth_date).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.birth_place || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.age || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.gender || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.religion || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.marital_status || '-'}</td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate" title={employee.citizen_id_address || '-'}>{employee.citizen_id_address || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{new Date(employee.join_date).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.resign_date ? new Date(employee.resign_date).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.sign_date ? new Date(employee.sign_date).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.end_date ? new Date(employee.end_date).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${employee.status_employee === 'Permanent' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {employee.status_employee}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {employee.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.ptkp_status}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.bank_name || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.bank_account || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.bank_account_holder || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    <button onClick={() => navigate(`/employees/${employee.id}`)} className="text-blue-600 hover:text-blue-900 mr-3">View</button>
                    <button onClick={() => handleDelete(employee.id, employee.full_name)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {pagination && (
          <div className="bg-white shadow rounded-lg p-4 mt-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Rows per page:</label>
                  <select
                    value={state.limit}
                    onChange={(e) => setState({ limit: e.target.value, page: '1' })}
                    className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setState({ page: '1' })}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  First
                </button>
                <button
                  onClick={() => setState({ page: String(pagination.page - 1) })}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setState({ page: String(pagination.page + 1) })}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Next
                </button>
                <button
                  onClick={() => setState({ page: String(pagination.totalPages) })}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          {state.search ? 'No employees found' : 'Search for employees to see results'}
        </div>
      )}
    </div>
  )
}
