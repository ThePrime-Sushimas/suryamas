import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { employeeBranchesApi } from '../api/employeeBranches.api'
import { branchesApi } from '@/features/branches/api/branches.api'
import { useToast } from '@/contexts/ToastContext'
import type { EmployeeBranch } from '../api/types'

type BranchOption = {
  id: string
  name: string
  code: string
  isAssigned: boolean
}

export default function EmployeeBranchEditPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { success, error: showError } = useToast()
  const { selected, getById, loading } = useEmployeeBranchesStore()
  
  const [employeeBranches, setEmployeeBranches] = useState<EmployeeBranch[]>([])
  const [allBranches, setAllBranches] = useState<BranchOption[]>([])
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set())
  const [primaryBranchId, setPrimaryBranchId] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const isMountedRef = useRef(true)

  // Fetch employee branch detail
  useEffect(() => {
    if (!id) {
      setNotFound(true)
      return
    }

    isMountedRef.current = true
    
    const fetchDetail = async () => {
      try {
        await getById(id)
      } catch (err) {
        if (isMountedRef.current) {
          setNotFound(true)
          showError('Data tidak ditemukan')
        }
      }
    }

    fetchDetail()

    return () => {
      isMountedRef.current = false
    }
  }, [id, getById, showError])

  // Fetch employee branches and all branches
  useEffect(() => {
    if (!selected?.employee_id) return

    isMountedRef.current = true
    setIsLoadingData(true)

    const fetchData = async () => {
      try {
        const [empBranches, branchesRes] = await Promise.all([
          employeeBranchesApi.getByEmployeeId(selected.employee_id),
          branchesApi.list(1, 1000)
        ])

        if (isMountedRef.current) {
          setEmployeeBranches(empBranches)
          
          const assignedIds = new Set(empBranches.map(eb => eb.branch_id))
          const branchOptions: BranchOption[] = branchesRes.data.map(b => ({
            id: b.id,
            name: b.branch_name,
            code: b.branch_code,
            isAssigned: assignedIds.has(b.id)
          }))
          
          setAllBranches(branchOptions)
        }
      } catch (err) {
        if (isMountedRef.current) {
          showError('Gagal memuat data')
          console.error('Failed to fetch data:', err)
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingData(false)
        }
      }
    }

    fetchData()

    return () => {
      isMountedRef.current = false
    }
  }, [selected?.employee_id, showError])

  const handleBranchToggle = (branchId: string) => {
    setSelectedBranches(prev => {
      const next = new Set(prev)
      if (next.has(branchId)) {
        next.delete(branchId)
        // If unchecked branch was primary, clear primary selection
        if (primaryBranchId === branchId) {
          setPrimaryBranchId(null)
        }
      } else {
        next.add(branchId)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedBranches.size === 0) {
      showError('Pilih minimal 1 branch untuk ditambahkan')
      return
    }

    if (!selected) return

    setIsSubmitting(true)
    try {
      const promises = Array.from(selectedBranches).map(branchId =>
        employeeBranchesApi.create({
          employee_id: selected.employee_id,
          branch_id: branchId,
          is_primary: branchId === primaryBranchId
        })
      )

      await Promise.all(promises)

      if (isMountedRef.current) {
        success(`${selectedBranches.size} branch berhasil ditambahkan`)
        navigate('/employee-branches')
      }
    } catch (err) {
      if (isMountedRef.current) {
        showError('Gagal menambahkan branch')
        console.error('Failed to add branches:', err)
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  if (notFound) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Data Tidak Ditemukan</h2>
          <p className="text-gray-600 mb-4">Employee branch yang Anda cari tidak ditemukan.</p>
          <button
            onClick={() => navigate('/employee-branches')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Kembali ke Daftar
          </button>
        </div>
      </div>
    )
  }

  if (loading.detail || !selected || isLoadingData) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">Memuat data...</p>
      </div>
    )
  }

  const primaryBranch = employeeBranches.find(eb => eb.is_primary)
  const unassignedBranches = allBranches.filter(b => !b.isAssigned)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tambah Branch ke Employee</h1>
        <button
          onClick={() => navigate('/employee-branches')}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
        >
          Kembali
        </button>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        {/* Employee Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Employee
          </label>
          <div className="px-3 py-2 bg-gray-50 border rounded-lg text-gray-900">
            {selected.employee_name}
          </div>
        </div>

        {/* Primary Branch */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Branch
          </label>
          <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900">
            {primaryBranch ? (
              <div className="flex items-center justify-between">
                <span>{primaryBranch.branch_name}</span>
                <span className="text-xs text-blue-600 font-medium">PRIMARY</span>
              </div>
            ) : (
              <span className="text-gray-500 italic">Belum ada primary branch</span>
            )}
          </div>
        </div>

        {/* Branch Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Branch <span className="text-gray-500 text-xs">(Pilih branch yang ingin ditambahkan)</span>
          </label>
          
          {unassignedBranches.length === 0 ? (
            <div className="px-3 py-8 bg-gray-50 border rounded-lg text-center text-gray-500">
              Semua branch sudah ditambahkan ke employee ini
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {unassignedBranches.map(branch => (
                <div
                  key={branch.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedBranches.has(branch.id)}
                    onChange={() => handleBranchToggle(branch.id)}
                    disabled={isSubmitting}
                    className="w-4 h-4 text-blue-600 rounded disabled:cursor-not-allowed"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{branch.name}</div>
                    <div className="text-sm text-gray-600">Kode: {branch.code}</div>
                  </div>
                  {selectedBranches.has(branch.id) && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="primary_branch"
                        checked={primaryBranchId === branch.id}
                        onChange={() => setPrimaryBranchId(branch.id)}
                        disabled={isSubmitting}
                        className="w-4 h-4 text-blue-600 disabled:cursor-not-allowed"
                      />
                      <span className="text-blue-600 font-medium">Set Primary</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedBranches.size > 0 && (
            <div className="text-sm mt-2 space-y-1">
              <p className="text-blue-600">
                {selectedBranches.size} branch dipilih
              </p>
              {primaryBranchId && (
                <p className="text-green-600">
                  Primary: {allBranches.find(b => b.id === primaryBranchId)?.name}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/employee-branches')}
            disabled={isSubmitting}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedBranches.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Tambah Branch'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
