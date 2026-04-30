import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompaniesStore } from '../store/companies.store'
import { CompanyTable } from '../components/CompanyTable'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { Building2, Plus, Search, Filter, X, AlertCircle } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'

type CompanyFilter = {
  status?: 'active' | 'inactive' | 'suspended' | 'closed'
  company_type?: 'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'
}

export default function CompaniesPage() {
  const navigate = useNavigate()
  const { companies, loading, error: storeError, pagination, fetchPage, searchPage, deleteCompany, reset, clearError } = useCompaniesStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CompanyFilter>({ status: 'active' })
  const [showFilter, setShowFilter] = useState(false)
  const [confirm, setConfirm] = useState<{ open: boolean; id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const debouncedSearch = useDebounce(search, 500)
  const toast = useToast()

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filter.status) count++
    if (filter.company_type) count++
    return count
  }, [filter.status, filter.company_type])

  const doFetch = useCallback((page: number, limit?: number) => {
    const effectiveLimit = limit ?? pagination.limit
    if (debouncedSearch) {
      searchPage(debouncedSearch, page, effectiveLimit, filter)
    } else {
      fetchPage(page, effectiveLimit, undefined, filter)
    }
  }, [debouncedSearch, filter, pagination.limit, searchPage, fetchPage])

  // Search/filter berubah → reset page 1
  useEffect(() => {
    const effectiveLimit = pagination.limit
    if (debouncedSearch) {
      searchPage(debouncedSearch, 1, effectiveLimit, filter)
    } else {
      fetchPage(1, effectiveLimit, undefined, filter)
    }
  }, [debouncedSearch, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { return () => { reset() } }, [reset])

  const handlePageChange = useCallback((page: number) => doFetch(page), [doFetch])
  const handleLimitChange = useCallback((limit: number) => doFetch(1, limit), [doFetch])

  const handleDeleteClick = useCallback((id: string) => {
    const company = companies.find(c => c.id === id)
    setConfirm({ open: true, id, name: company?.company_name || 'perusahaan ini' })
  }, [companies])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirm) return
    setIsDeleting(true)
    try {
      await deleteCompany(confirm.id)
      toast.success('Perusahaan berhasil dihapus')
      doFetch(1)
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setIsDeleting(false)
      setConfirm(null)
    }
  }, [confirm, deleteCompany, doFetch, toast])

  const setFilterKey = useCallback(
    <K extends keyof CompanyFilter>(key: K, value?: CompanyFilter[K]) => {
      setFilter(prev => {
        const newFilter = { ...prev }
        if (!value) delete newFilter[key]
        else newFilter[key] = value
        return newFilter
      })
    }, []
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Perusahaan</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/companies/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Tambah Perusahaan
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari perusahaan..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
              : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}>
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={filter.status || ''} onChange={e => setFilterKey('status', (e.target.value || undefined) as CompanyFilter['status'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="suspended">Ditangguhkan</option>
                <option value="closed">Ditutup</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe Perusahaan</label>
              <select value={filter.company_type || ''} onChange={e => setFilterKey('company_type', (e.target.value || undefined) as CompanyFilter['company_type'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Semua Tipe</option>
                <option value="PT">PT</option>
                <option value="CV">CV</option>
                <option value="Firma">Firma</option>
                <option value="Koperasi">Koperasi</option>
                <option value="Yayasan">Yayasan</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {storeError ? (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">Terjadi kesalahan saat memuat data.</p>
            <button onClick={() => { clearError(); doFetch(1) }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Coba Lagi</button>
          </div>
        ) : loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="animate-pulse">
              <div className="h-10 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
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
            <CompanyTable
              companies={companies}
              onView={id => navigate(`/companies/${id}`)}
              onEdit={id => navigate(`/companies/${id}/edit`)}
              onDelete={handleDeleteClick}
              canEdit={true}
              canDelete={true}
            />
            {pagination.total > 0 && (
              <Pagination
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                currentLength={companies.length}
                loading={loading}
              />
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirm?.open || false}
        title="Hapus Perusahaan"
        message={`Yakin ingin menghapus "${confirm?.name}"? Status akan diubah menjadi nonaktif.`}
        confirmText={isDeleting ? 'Menghapus...' : 'Hapus'}
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => !isDeleting && setConfirm(null)}
      />
    </div>
  )
}
