import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBranchesStore } from '../store/branches.store'
import { BranchTable } from '../components/BranchTable'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { MapPin, Plus, Search, X, AlertCircle } from 'lucide-react'

export default function BranchesPage() {
  const navigate = useNavigate()
  const {
    branches, loading, error: storeError, page, limit, total, totalPages, hasNext, hasPrev,
    fetchBranches, searchBranches, deleteBranch, setPage, setLimit, clearError,
  } = useBranchesStore()
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<{ open: boolean; id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const toast = useToast()
  const debouncedSearch = useDebounce(search, 400)

  const fetchData = useCallback(() => {
    if (debouncedSearch) searchBranches(debouncedSearch, page, limit)
    else fetchBranches(page, limit)
  }, [page, limit, debouncedSearch, fetchBranches, searchBranches])

  useEffect(() => { fetchData() }, [fetchData])

  const handleClearSearch = () => { setSearch(''); setPage(1) }

  const handleDeleteClick = useCallback((id: string) => {
    const branch = branches.find(b => b.id === id)
    setConfirm({ open: true, id, name: branch?.branch_name || '' })
  }, [branches])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirm) return
    setIsDeleting(true)
    try {
      await deleteBranch(confirm.id)
      toast.success('Branch berhasil dihapus')
      fetchData()
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setIsDeleting(false)
      setConfirm(null)
    }
  }, [confirm, deleteBranch, fetchData, toast])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Branches</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{total} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/branches/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Tambah Branch
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari branch..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          {search && (
            <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {storeError ? (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">Terjadi kesalahan saat memuat data.</p>
            <button onClick={() => { clearError(); fetchData() }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Coba Lagi</button>
          </div>
        ) : loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="animate-pulse">
              <div className="h-10 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/5" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <BranchTable
              branches={branches}
              onView={id => navigate(`/branches/${id}`)}
              onEdit={id => navigate(`/branches/${id}/edit`)}
              onDelete={handleDeleteClick}
              canEdit={true}
              canDelete={true}
            />
            {total > 0 && (
              <Pagination
                pagination={{ page, limit, total, totalPages, hasNext, hasPrev }}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1) }}
                currentLength={branches.length}
                loading={loading}
              />
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirm?.open || false}
        onClose={() => !isDeleting && setConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Branch"
        message={`Yakin ingin menghapus "${confirm?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={isDeleting ? 'Menghapus...' : 'Hapus'}
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
