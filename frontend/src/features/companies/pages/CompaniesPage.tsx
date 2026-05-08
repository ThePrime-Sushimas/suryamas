import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Search, Filter, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { useCompanies, useDeleteCompany } from '../api/companies.api'
import { CompanyTable } from '../components/CompanyTable'
import type { Company } from '../types'

export default function CompaniesPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [status, setStatus] = useState('active')
  const [companyType, setCompanyType] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const queryParams = useMemo(() => ({
    page, limit, search: debouncedSearch || undefined,
    status: status || undefined, company_type: companyType || undefined,
  }), [page, limit, debouncedSearch, status, companyType])

  const { data, isLoading } = useCompanies(queryParams)
  const deleteCompany = useDeleteCompany()

  const companies = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const activeFilterCount = (status ? 1 : 0) + (companyType ? 1 : 0)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCompany.mutateAsync(deleteTarget.id)
      toast.success('Perusahaan berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus perusahaan')) }
    finally { setDeleteTarget(null) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Perusahaan</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/companies/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Tambah Perusahaan
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari perusahaan..." value={search} onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilter ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>}
          </button>
        </div>
        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="suspended">Ditangguhkan</option>
              <option value="closed">Ditutup</option>
            </select>
            <select value={companyType} onChange={e => { setCompanyType(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Tipe</option>
              <option value="PT">PT</option>
              <option value="CV">CV</option>
              <option value="Firma">Firma</option>
              <option value="Koperasi">Koperasi</option>
              <option value="Yayasan">Yayasan</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <CompanyTable companies={companies}
          onView={id => navigate(`/companies/${id}/edit`)} onEdit={id => navigate(`/companies/${id}/edit`)}
          onDelete={id => { const c = companies.find(x => x.id === id); if (c) setDeleteTarget(c) }}
          canEdit={true} canDelete={true} />
        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={companies.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Perusahaan" message={`Yakin ingin menghapus "${deleteTarget?.company_name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteCompany.isPending} />
    </div>
  )
}
