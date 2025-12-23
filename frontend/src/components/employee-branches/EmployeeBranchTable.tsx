import { useState, Fragment } from 'react'
import { Trash2, Star, Edit2, ChevronDown, ChevronRight } from 'lucide-react'
import type { EmployeeBranch } from '@/types/employeeBranch'

interface EmployeeBranchTableProps {
  data: EmployeeBranch[]
  loading?: boolean
  onDelete?: (id: string) => void
  onSetPrimary?: (employeeId: string, branchId: string) => void
  onSelectionChange?: (selected: string[]) => void
  onEdit?: (id: string) => void
}

export function EmployeeBranchTable({
  data,
  loading,
  onDelete,
  onSetPrimary,
  onSelectionChange,
  onEdit
}: EmployeeBranchTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set())

  const groupedData = data.reduce<Record<string, { employee_name: string; branches: EmployeeBranch[] }>>((acc, item) => {
    const empId = item.employee_id || ''
    if (!acc[empId]) {
      acc[empId] = {
        employee_name: item.employee_name || '',
        branches: []
      }
    }
    acc[empId].branches.push(item)
    return acc
  }, {})

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(data.map(d => d.id))
      setSelected(newSelected)
      onSelectionChange?.(Array.from(newSelected))
    } else {
      setSelected(new Set())
      onSelectionChange?.([])
    }
  }

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selected)
    if (checked) newSelected.add(id)
    else newSelected.delete(id)
    setSelected(newSelected)
    onSelectionChange?.(Array.from(newSelected))
  }

  const toggleEmployee = (employeeId: string) => {
    const next = new Set(expandedEmployees)
    if (next.has(employeeId)) next.delete(employeeId)
    else next.add(employeeId)
    setExpandedEmployees(next)
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (data.length === 0) {
    return <div className="text-center py-8 text-gray-500">No data found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="px-4 py-2 text-left w-12">
              <input
                type="checkbox"
                checked={selected.size === data.length && data.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded"
              />
            </th>
            <th className="px-4 py-2 text-left">Employee</th>
            <th className="px-4 py-2 text-left">Branches</th>
            <th className="px-4 py-2 text-left">Primary</th>
            <th className="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedData).map(([employeeId, { employee_name, branches }]) => {
            const isExpanded = expandedEmployees.has(employeeId)
            const primaryBranch = branches.find(b => b.is_primary)

            return (
              <Fragment key={employeeId}>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={branches.every(b => selected.has(b.id))}
                      onChange={(e) => {
                        branches.forEach(b => handleSelect(b.id, e.target.checked))
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-2 font-medium">{employee_name}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleEmployee(employeeId)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <span>{branches.length} branch{branches.length !== 1 ? 'es' : ''}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    {primaryBranch && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                        <Star size={14} /> {primaryBranch.branch_name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleEmployee(employeeId)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </td>
                </tr>

                {isExpanded &&
                  branches.map((item) => (
                    <tr key={item.id} className="border-b bg-blue-50 hover:bg-blue-100">
                      <td className="px-4 py-3 pl-12">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={(e) => handleSelect(item.id, e.target.checked)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">└─</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <div>
                            <div className="font-medium text-gray-900">{item.branch_name}</div>
                            <div className="text-xs text-gray-500">{item.branch_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.is_primary ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium">
                            <Star size={14} fill="currentColor" /> Primary
                          </span>
                        ) : (
                          <button
                            onClick={() => onSetPrimary?.(item.employee_id, item.branch_id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                            title="Set as primary"
                          >
                            <Star size={16} />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => onEdit?.(item.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-200 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => onDelete?.(item.id)}
                            className="p-1.5 text-red-600 hover:bg-red-200 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
