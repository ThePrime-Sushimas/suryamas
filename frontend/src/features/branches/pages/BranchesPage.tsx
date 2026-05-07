import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Plus, Search, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { useBranches, useDeleteBranch } from '../api/branches.api'
import { BranchTable } from '../components/BranchTable'
import type { Branch, BranchFilter } from '../types'

export default function BranchesPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const filter = useMemo((): BranchFilter | null => {
    if (debouncedSearch) return { search: debouncedSearch }
    return null
  }, [debouncedSearch])

  const { data, isLoading } = useBranches({ page, limit, filter })
  const deleteBranch = useDeleteBranch()

  const branches = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteBranch.mutateAsync(deleteTarget.id)
      toast.success('Cabang berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus cabang')) }
    finally { setDeleteTarget(null) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cabang</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/branches/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Tambah Cabang
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Cari cabang..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <BranchTable branches={branches} loading={isLoading}
          onView={id => navigate(`/branches/${id}/edit`)}
          onEdit={id => navigate(`/branches/${id}/edit`)}
          onDelete={id => { const b = branches.find(x => x.id === id); if (b) setDeleteTarget(b) }}
          canEdit={true} canDelete={true} />
        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={branches.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete}
        title="Hapus Cabang" message={`Yakin ingin menghapus "${deleteTarget?.branch_name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteBranch.isPending} />
    </div>
  )
}
