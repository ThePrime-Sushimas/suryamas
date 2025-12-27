import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmployeeBranchBulkForm } from '../components/EmployeeBranchBulkForm'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { useToast } from '@/contexts/ToastContext'
import { employeesApi } from '@/features/employees/api/employees.api'
import { branchesApi } from '@/features/branches/api/branches.api'
import type { CreateEmployeeBranchDTO } from '../api/types'

type BulkSubmitData = {
  employee_id: string
  branches: { branch_id: string; is_primary: boolean }[]
}

type BulkSubmitResult = {
  successCount: number
  failCount: number
  errors: Array<{ branch_id: string; error: string }>
}

type ProgressCallback = (current: number, total: number) => void

// Custom hook for bulk create logic
function useBulkCreateEmployeeBranches() {
  const { create } = useEmployeeBranchesStore()
  const abortControllerRef = useRef<AbortController | null>(null)

  const bulkCreate = useCallback(
    async (data: BulkSubmitData, onProgress?: ProgressCallback): Promise<BulkSubmitResult> => {
      // Create abort controller for this operation
      abortControllerRef.current = new AbortController()

      const result: BulkSubmitResult = {
        successCount: 0,
        failCount: 0,
        errors: [],
      }

      // Order: primary first to avoid constraint violations
      const primaryBranch = data.branches.find(b => b.is_primary)
      const otherBranches = data.branches.filter(b => !b.is_primary)
      const orderedBranches = primaryBranch ? [primaryBranch, ...otherBranches] : data.branches

      for (let i = 0; i < orderedBranches.length; i++) {
        const branch = orderedBranches[i]
        onProgress?.(i + 1, orderedBranches.length)
        // Check if operation was aborted
        if (abortControllerRef.current.signal.aborted) {
          result.errors.push({
            branch_id: branch.branch_id,
            error: 'Operation cancelled',
          })
          result.failCount++
          continue
        }

        try {
          const payload: CreateEmployeeBranchDTO = {
            employee_id: data.employee_id,
            branch_id: branch.branch_id,
            is_primary: branch.is_primary,
          }

          const res = await create(payload)

          if (res) {
            result.successCount++
          } else {
            result.failCount++
            result.errors.push({
              branch_id: branch.branch_id,
              error: 'Create returned null (possible duplicate or constraint violation)',
            })
          }
        } catch (err) {
          result.failCount++
          result.errors.push({
            branch_id: branch.branch_id,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
          console.error(`Failed to create employee-branch relation:`, {
            employee_id: data.employee_id,
            branch_id: branch.branch_id,
            error: err,
          })
        }
      }

      return result
    },
    [create]
  )

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  return { bulkCreate, abort }
}

export default function EmployeeBranchCreatePage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { bulkCreate, abort } = useBulkCreateEmployeeBranches()

  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch initial data with abort support
  useEffect(() => {
    isMountedRef.current = true
    abortControllerRef.current = new AbortController()

    const fetchData = async () => {
      try {
        const [empRes, branchRes] = await Promise.all([
          employeesApi.list(1, 1000),
          branchesApi.list(1, 1000),
        ])

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setEmployees(empRes.data.map(e => ({ id: e.id, name: e.full_name })))
          setBranches(branchRes.data.map(b => ({ id: b.id, name: b.branch_name })))
        }
      } catch (err) {
        if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          showError('Gagal memuat data')
          console.error('Failed to fetch employees/branches:', err)
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingData(false)
        }
      }
    }

    fetchData()

    // Cleanup
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [showError])

  const onSubmit = useCallback(
    async (data: BulkSubmitData) => {
      if (isSubmitting) return // Prevent double submit

      setIsSubmitting(true)
      setProgress(null)

      try {
        const result = await bulkCreate(data, (current, total) => {
          if (isMountedRef.current) {
            setProgress({ current, total })
          }
        })

        // Only proceed if component is still mounted
        if (!isMountedRef.current) return

        // Show feedback
        if (result.successCount > 0) {
          success(`Berhasil menambahkan ${result.successCount} cabang`)
        }

        if (result.failCount > 0) {
          const errorMsg = `${result.failCount} cabang gagal ditambahkan`
          const details = result.errors.length > 0 ? ` (${result.errors[0].error})` : ''
          showError(errorMsg + details)

          // Log all errors for debugging
          console.error('Bulk create errors:', result.errors)
        }

        // Navigate only if all succeeded
        if (result.failCount === 0 && isMountedRef.current) {
          navigate('/employee-branches')
        }
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false)
          setProgress(null)
        }
      }
    },
    [isSubmitting, bulkCreate, success, showError, navigate]
  )

  const handleCancel = useCallback(() => {
    if (isSubmitting) {
      const confirmed = confirm('Proses sedang berjalan. Batalkan dan keluar?')
      if (!confirmed) return
      abort()
    }
    navigate('/employee-branches')
  }, [isSubmitting, abort, navigate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSubmitting) {
        abort()
      }
    }
  }, [isSubmitting, abort])

  if (isLoadingData) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">Memuat data employee dan cabang...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Tambah Employee Branch</h1>
      
      {isSubmitting && progress && (
        <div className="mb-4 rounded-lg border p-4 bg-blue-50">
          <p className="text-sm text-blue-700 font-medium">
            Menyimpan data... ({progress.current}/{progress.total})
          </p>
          <div className="mt-2 h-2 bg-blue-100 rounded">
            <div
              className="h-2 bg-blue-600 rounded transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-xl border p-6">
        <EmployeeBranchBulkForm
          employees={employees}
          branches={branches}
          loading={isSubmitting}
          onSubmit={onSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
