import type { MetricUnit } from '../types'

interface MetricUnitTableProps {
  metricUnits: MetricUnit[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  loading?: boolean
}

export const MetricUnitTable = ({ metricUnits, onEdit, onDelete, loading }: MetricUnitTableProps) => {
  const handleDelete = (id: string, unitName: string) => {
    if (confirm(`Delete metric unit "${unitName}"?`)) {
      onDelete(id)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    )
  }

  if (metricUnits.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p className="mt-2 text-gray-500 font-medium">No metric units found</p>
        <p className="text-sm text-gray-400">Get started by creating a new metric unit</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {metricUnits.map(unit => (
            <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{unit.metric_type}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{unit.unit_name}</td>
              <td className="px-6 py-4 text-sm text-gray-600">
                <div className="max-w-xs truncate" title={unit.notes || undefined}>
                  {unit.notes || <span className="text-gray-400">-</span>}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  unit.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {unit.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                <button 
                  onClick={() => onEdit(unit.id)} 
                  className="text-blue-600 hover:text-blue-900 transition-colors"
                  aria-label={`Edit ${unit.unit_name}`}
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(unit.id, unit.unit_name)} 
                  className="text-red-600 hover:text-red-900 transition-colors"
                  aria-label={`Delete ${unit.unit_name}`}
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
