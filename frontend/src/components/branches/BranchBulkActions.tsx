import { Trash2, CheckCircle } from 'lucide-react'

interface BranchBulkActionsProps {
  selectedIds: string[]
  onBulkDelete: () => void
  onBulkUpdateStatus: (status: string) => void
  isLoading?: boolean
}

export const BranchBulkActions = ({
  selectedIds,
  onBulkDelete,
  onBulkUpdateStatus,
  isLoading,
}: BranchBulkActionsProps) => {
  if (selectedIds.length === 0) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-blue-600" />
        <span className="text-sm font-medium text-gray-900">
          {selectedIds.length} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        <select
          onChange={(e) => {
            if (e.target.value) {
              onBulkUpdateStatus(e.target.value)
              e.target.value = ''
            }
          }}
          disabled={isLoading}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
        >
          <option value="">Change Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          onClick={() => {
            if (confirm(`Delete ${selectedIds.length} branch(es)?`)) {
              onBulkDelete()
            }
          }}
          disabled={isLoading}
          className="px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  )
}
