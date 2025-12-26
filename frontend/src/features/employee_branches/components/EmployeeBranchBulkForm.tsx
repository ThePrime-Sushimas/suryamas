import { useState } from 'react'

type Props = {
  employees: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  loading: boolean
  onSubmit: (data: { employee_id: string; branches: { branch_id: string; is_primary: boolean }[] }) => void
  onCancel: () => void
}

export function EmployeeBranchBulkForm({ employees, branches, loading, onSubmit, onCancel }: Props) {
  const [employeeId, setEmployeeId] = useState('')
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set())
  const [primaryBranch, setPrimaryBranch] = useState('')

  const toggleBranch = (branchId: string) => {
    const newSet = new Set(selectedBranches)
    if (newSet.has(branchId)) {
      newSet.delete(branchId)
      if (primaryBranch === branchId) setPrimaryBranch('')
    } else {
      newSet.add(branchId)
      if (newSet.size === 1) setPrimaryBranch(branchId)
    }
    setSelectedBranches(newSet)
  }

  const handleSubmit = () => {
    if (!employeeId || selectedBranches.size === 0) return
    
    const branchesData = Array.from(selectedBranches).map(branch_id => ({
      branch_id,
      is_primary: branch_id === primaryBranch
    }))

    onSubmit({ employee_id: employeeId, branches: branchesData })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
        <select
          className="w-full px-3 py-2 border rounded-lg"
          value={employeeId}
          onChange={e => setEmployeeId(e.target.value)}
          disabled={loading}
        >
          <option value="">-- Pilih Employee --</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pilih Cabang * ({selectedBranches.size} dipilih)
        </label>
        <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
          {branches.map(branch => (
            <div key={branch.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
              <label className="flex items-center flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBranches.has(branch.id)}
                  onChange={() => toggleBranch(branch.id)}
                  className="mr-3"
                />
                <span>{branch.name}</span>
              </label>
              {selectedBranches.has(branch.id) && (
                <label className="flex items-center ml-4">
                  <input
                    type="radio"
                    name="primary"
                    checked={primaryBranch === branch.id}
                    onChange={() => setPrimaryBranch(branch.id)}
                    className="mr-2"
                  />
                  <span className="text-sm text-blue-600">Primary</span>
                </label>
              )}
            </div>
          ))}
        </div>
        {selectedBranches.size > 0 && !primaryBranch && (
          <p className="text-sm text-red-600 mt-1">Pilih 1 cabang sebagai primary</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button 
          className="px-4 py-2 rounded border" 
          onClick={onCancel} 
          disabled={loading}
        >
          Batal
        </button>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={loading || !employeeId || selectedBranches.size === 0 || !primaryBranch}
        >
          {loading ? 'Menyimpan...' : `Simpan ${selectedBranches.size} Cabang`}
        </button>
      </div>
    </div>
  )
}
