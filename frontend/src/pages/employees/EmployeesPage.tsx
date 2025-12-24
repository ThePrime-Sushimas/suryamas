import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeStore } from '../../stores/employeeStore'
import ExportButton from '../../components/ExportButton'
import ImportModal from '../../components/ImportModal'
import BulkActionBar from '../../components/BulkActionBar'
import { useBulkSelection } from '../../hooks/useBulkSelection'
import { useIsMobile } from '../../hooks/useMediaQuery'
import EmployeeCard from '../../components/mobile/EmployeeCard'
import FloatingActionButton from '../../components/mobile/FloatingActionButton'

export default function EmployeesPage() {
  const { employees, searchEmployees, deleteEmployee, bulkUpdateActive, bulkDelete, fetchFilterOptions, isLoading } = useEmployeeStore()
  const { selectedIds, selectAll, selectOne, clearSelection, isSelected, isAllSelected, selectedCount } = useBulkSelection(employees)
  const navigate = useNavigate()
  
  const [state, setState] = useState({
    sort: 'full_name',
    order: 'asc' as 'asc' | 'desc',
    search: '',
    showImport: false,
    selectedImage: '',
  })

  useEffect(() => {
    fetchFilterOptions()
    handleFetch()
  }, [state.sort, state.order, state.search])

  const handleFetch = () => {
    searchEmployees(state.search, state.sort, state.order, {}, 1, 1000)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleClearSearch = () => {
    setState(prev => ({ ...prev, search: '', page: 1 }))
  }

  const handleSort = (field: string) => {
    const newOrder = state.sort === field && state.order === 'asc' ? 'desc' : 'asc'
    setState(prev => ({ ...prev, sort: field, order: newOrder, page: 1 }))
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

  const isMobile = useIsMobile()

  return (
    <div className="relative">
      <FloatingActionButton />
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 md:mb-6 gap-3">
        <h1 className="text-xl md:text-2xl font-bold">Employees</h1>
        <div className="flex flex-wrap gap-2">
          <BulkActionBar
            selectedCount={selectedCount}
            actions={[
              { label: 'Set Active', onClick: () => handleBulkUpdateActive(true), className: 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700' },
              { label: 'Set Inactive', onClick: () => handleBulkUpdateActive(false), className: 'px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700' },
              { label: 'Delete', onClick: handleBulkDelete, className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700' },
            ]}
          />
          <ExportButton endpoint="/employees" filename="employees" filter={{}} />
          <button
            onClick={() => setState(prev => ({ ...prev, showImport: !prev.showImport }))}
            className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded hover:bg-blue-700 text-sm md:text-base min-h-[44px]"
          >
            {isMobile ? 'Import' : 'Import Excel'}
          </button>
          <button
            onClick={() => navigate('/employees/create')}
            className="bg-green-600 text-white px-3 md:px-4 py-2 rounded hover:bg-green-700 text-sm md:text-base min-h-[44px]"
          >
            {isMobile ? '+ Add' : '+ Create Employee'}
          </button>
        </div>
      </div>

      <ImportModal 
        isOpen={state.showImport} 
        onClose={() => setState(prev => ({ ...prev, showImport: false }))}
        onSuccess={() => { setState(prev => ({ ...prev, showImport: false })); handleFetch() }}
        endpoint="/employees"
        title="Employees"
      />

      <div className="bg-white shadow rounded-lg p-4 md:p-6 mb-4 md:mb-6">
        <form onSubmit={handleSearch} className="space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row gap-2 md:gap-3">
            <input
              type="text"
              placeholder="Search employees..."
              value={state.search}
              onChange={(e) => setState(prev => ({ ...prev, search: e.target.value }))}
              className="flex-1 px-3 md:px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base min-h-[44px]"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm md:text-base min-h-[44px] whitespace-nowrap"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
            {state.search && (
              <button
                type="button"
                onClick={handleClearSearch}
                disabled={isLoading}
                className="bg-gray-300 text-gray-700 px-4 md:px-6 py-2 rounded hover:bg-gray-400 disabled:opacity-50 text-sm md:text-base min-h-[44px] whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {state.selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setState(prev => ({ ...prev, selectedImage: '' }))}
        >
          <div className="relative w-1/2 p-4">
            <img 
              src={state.selectedImage} 
              alt="Preview" 
              className="w-full h-auto object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setState(prev => ({ ...prev, selectedImage: '' }))}
              className="absolute top-6 right-6 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {employees.length > 0 ? (
        <>
        {isMobile ? (
          <div className="space-y-3">
            {employees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={{
                  ...employee,
                  branch_name: employee.branch_name ?? '-',
                }}
                onDelete={handleDelete}
                isSelected={isSelected(employee.id)}
                onSelect={selectOne}
              />
            ))}
          </div>
        ) : (
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('brand_name')}>Brand Name <SortIcon field="brand_name" /></th>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort('years_of_service')}>Years of Service <SortIcon field="years_of_service" /></th>
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
                        onClick={() => setState(prev => ({ ...prev, selectedImage: employee.profile_picture || '' }))}
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
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{employee.brand_name || '-'}</td>
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
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {employee.years_of_service ? `${employee.years_of_service.years}y ${employee.years_of_service.months}m ${employee.years_of_service.days}d` : '-'}
                  </td>
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
                    <button onClick={() => navigate(`/employees/${employee.id}`)} className="text-blue-600 hover:text-blue-900 mr-2">View</button>
                    <button onClick={() => navigate(`/employees/edit/${employee.id}`)} className="text-green-600 hover:text-green-900 mr-2">Edit</button>
                    <button onClick={() => handleDelete(employee.id, employee.full_name)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        </>
      ) : (
        <div className="bg-white shadow rounded-lg p-6 md:p-8 text-center text-gray-500 text-sm md:text-base">
          {state.search ? 'No employees found' : 'Search for employees to see results'}
        </div>
      )}
    </div>
  )
}
