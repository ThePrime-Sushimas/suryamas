import { useEffect, useCallback, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmployeeBranchForm } from '../components/EmployeeBranchForm'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { useToast } from '@/contexts/ToastContext'
import { employeesApi } from '@/features/employees/api/employees.api'
import { branchesApi } from '@/features/branches/api/branches.api'
import type { UpdateEmployeeBranchDTO } from '../api/types'

export default function EmployeeBranchEditPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { success, error: showError } = useToast()
  const { selected, getById, update, loading, error } = useEmployeeBranchesStore()
  
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

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

  // Fetch employees and branches
  useEffect(() => {
    isMountedRef.current = true
    abortControllerRef.current = new AbortController()

    const fetchData = async () => {
      try {
        const [empRes, branchRes] = await Promise.all([
          employeesApi.list(1, 1000),
          branchesApi.list(1, 1000),
        ])

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

    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [showError])

  const onSubmit = useCallback(
    async (payload: UpdateEmployeeBranchDTO) => {
      if (!id) return

      try {
        const res = await update(id, payload)
        
        if (!isMountedRef.current) return

        if (res) {
          success('Relasi berhasil diupdate')
          navigate('/employee-branches')
        } else {
          showError(error.update?.message || 'Gagal mengupdate relasi')
        }
      } catch (err) {
        if (isMountedRef.current) {
          showError('Terjadi kesalahan saat mengupdate')
          console.error('Update failed:', err)
        }
      }
    },
    [id, update, navigate, error, success, showError]
  )

  const handleCancel = useCallback(() => {
    navigate('/employee-branches')
  }, [navigate])

  // 404 Not Found
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

  // Loading state
  if (isLoadingData || loading.detail || !selected) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">Memuat data employee branch...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Edit Employee Branch</h1>
      <div className="bg-white rounded-xl border p-6">
        <EmployeeBranchForm
          mode="edit"
          initial={selected}
          employees={employees}
          branches={branches}
          loading={loading.update}
          onSubmit={onSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
