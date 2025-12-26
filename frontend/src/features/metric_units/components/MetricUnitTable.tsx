import type { MetricUnit } from '../types'

interface MetricUnitTableProps {
  metricUnits: MetricUnit[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const MetricUnitTable = ({ metricUnits, onEdit, onDelete }: MetricUnitTableProps) => {
  if (metricUnits.length === 0) {
    return <div className="text-center py-8 text-gray-500">No metric units found</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2 text-left">Type</th>
            <th className="border px-4 py-2 text-left">Unit Name</th>
            <th className="border px-4 py-2 text-left">Notes</th>
            <th className="border px-4 py-2 text-left">Status</th>
            <th className="border px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {metricUnits.map(unit => (
            <tr key={unit.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{unit.metric_type}</td>
              <td className="border px-4 py-2 font-semibold">{unit.unit_name}</td>
              <td className="border px-4 py-2">{unit.notes || '-'}</td>
              <td className="border px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${unit.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {unit.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="border px-4 py-2 space-x-2">
                <button onClick={() => onEdit(unit.id)} className="text-green-600 hover:underline text-sm">Edit</button>
                <button onClick={() => onDelete(unit.id)} className="text-red-600 hover:underline text-sm">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
