import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Search, Building2, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { BankAccountsSection } from '@/features/bank-accounts/components/BankAccountsSection'
import {
  useVendors,
  useCreateVendor,
  useDeleteVendor,
} from '../api/generalApi.api'
import { useVendorFilters } from '../hooks/useVendorFilters'
import type { VendorFilters, VendorSortBy } from '../utils/vendorFilters.url'
import { VENDOR_TYPE_LABELS, VENDOR_TYPE_OPTIONS } from '../constants'
import type { Vendor, VendorType } from '../api/generalApi.api'

interface VendorFormModalProps {
  open: boolean
  onClose: () => void
}

function VendorFormModal({ open, onClose }: VendorFormModalProps) {
  const writeCompanyId = useBranchContextStore(
    (s) => s.currentBranch?.company_id ?? s.branches[0]?.company_id,
  )
  const createMutation = useCreateVendor()

  const [form, setForm] = useState({
    vendor_code: '',
    vendor_name: '',
    vendor_type: '' as VendorType | '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedVendorId, setSavedVendorId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSavedVendorId(null)
    setForm({
      vendor_code: '',
      vendor_name: '',
      vendor_type: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    })
    setErrors({})
  }, [open])

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }))

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.vendor_code.trim()) errs.vendor_code = 'Kode vendor wajib diisi'
    if (!form.vendor_name.trim()) errs.vendor_name = 'Nama vendor wajib diisi'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Format email tidak valid'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const payload = {
      vendor_code: form.vendor_code,
      vendor_name: form.vendor_name,
      vendor_type: form.vendor_type || undefined,
      contact_person: form.contact_person || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    }

    const created = await createMutation.mutateAsync(payload)
    setSavedVendorId(created.id)
  }

  const isPending = createMutation.isPending

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {savedVendorId ? 'Vendor — Rekening Bank' : 'Tambah Vendor'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {!savedVendorId && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Kode Vendor *</label>
                  <input
                    type="text"
                    value={form.vendor_code}
                    onChange={(e) => set('vendor_code', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg ${errors.vendor_code ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {errors.vendor_code && <p className="text-xs text-red-500">{errors.vendor_code}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Tipe</label>
                  <select
                    value={form.vendor_type}
                    onChange={(e) => set('vendor_type', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  >
                    <option value="">-- Pilih Tipe --</option>
                    {VENDOR_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Nama Vendor *</label>
                <input
                  type="text"
                  value={form.vendor_name}
                  onChange={(e) => set('vendor_name', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg ${errors.vendor_name ? 'border-red-400' : 'border-gray-200'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">PIC / Contact Person</label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => set('contact_person', e.target.value)}
                  placeholder="Nama contact person"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input type="tel" placeholder="Telepon" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                <input type="email" placeholder="Email" value={form.email} onChange={(e) => set('email', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>

              <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2}
                placeholder="Alamat" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />

              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
                placeholder="Catatan" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />
            </>
          )}

          {savedVendorId && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 mb-3">
                Rekening untuk transfer ke vendor — data dari tabel <code className="text-[10px]">bank_accounts</code> (owner_type: vendor).
              </p>
              <BankAccountsSection
                ownerType="vendor"
                ownerId={savedVendorId}
                companyId={writeCompanyId}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm border rounded-lg">
            {savedVendorId ? 'Selesai' : 'Batal'}
          </button>
          {!savedVendorId && (
            <button type="button" onClick={handleSubmit} disabled={isPending}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
              {isPending ? 'Menyimpan...' : 'Simpan & Atur Bank'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SortIcon({ column, currentSort, currentOrder }: { column: VendorSortBy; currentSort: VendorSortBy; currentOrder: 'asc' | 'desc' }) {
  if (currentSort !== column) return <ArrowUpDown size={12} className="text-gray-300" />
  return currentOrder === 'asc'
    ? <ArrowUp size={12} className="text-blue-600" />
    : <ArrowDown size={12} className="text-blue-600" />
}

export default function VendorsPage() {
  const navigate = useNavigate()
  const {
    filters,
    searchInput,
    setSearchInput,
    apiQuery,
    setFilters,
    setPage,
  } = useVendorFilters()

  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)

  // Tab: 'vendor' (all except EMPLOYEE) or 'reimburse' (EMPLOYEE only)
  const activeTab = filters.vendorType === 'EMPLOYEE' ? 'reimburse' : 'vendor'
  const setTab = (tab: 'vendor' | 'reimburse') => {
    if (tab === 'reimburse') {
      setFilters({ vendorType: 'EMPLOYEE' })
    } else {
      setFilters({ vendorType: '' })
    }
  }

  // For "vendor" tab, filter out EMPLOYEE type options from the dropdown
  const vendorTypeOptions = activeTab === 'vendor'
    ? VENDOR_TYPE_OPTIONS.filter((o) => o.value !== 'EMPLOYEE')
    : VENDOR_TYPE_OPTIONS

  const { data, isLoading } = useVendors(apiQuery)
  const deleteMutation = useDeleteVendor()

  const vendors = data?.data ?? []
  const totalPages = data?.pagination?.totalPages ?? 1

  const toggleSort = (column: VendorSortBy) => {
    if (filters.sortBy === column) {
      setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })
    } else {
      setFilters({ sortBy: column, sortOrder: 'asc' })
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {activeTab === 'reimburse' ? 'Reimburse Karyawan' : 'Vendors'}
          </h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} {activeTab === 'reimburse' ? 'karyawan' : 'vendor'}</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> {activeTab === 'reimburse' ? 'Tambah Karyawan' : 'Tambah Vendor'}
        </button>
      </div>

      {/* Tab: Vendor / Reimburse */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 w-fit">
        <button
          type="button"
          onClick={() => setTab('vendor')}
          className={`px-4 py-1.5 text-xs rounded-md transition-colors ${
            activeTab === 'vendor'
              ? 'bg-white text-gray-900 font-medium shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Vendor
        </button>
        <button
          type="button"
          onClick={() => setTab('reimburse')}
          className={`px-4 py-1.5 text-xs rounded-md transition-colors ${
            activeTab === 'reimburse'
              ? 'bg-white text-gray-900 font-medium shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Reimburse
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'reimburse' ? 'Cari nama karyawan atau NIK...' : 'Cari nama atau kode vendor...'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        {activeTab === 'vendor' && (
          <select
            value={filters.vendorType}
            onChange={(e) => setFilters({ vendorType: e.target.value as VendorType | '' })}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            <option value="">Semua Tipe</option>
            {vendorTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        <select
          value={filters.isActive}
          onChange={(e) => setFilters({ isActive: e.target.value as VendorFilters['isActive'] })}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="true">Aktif</option>
          <option value="false">Non-aktif</option>
          <option value="">Semua</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat...</div>
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Tidak ada vendor</p>
          </div>
        ) : (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <button type="button" onClick={() => toggleSort('vendor_code')} className="flex items-center gap-1 hover:text-gray-700">
                      Kode
                      <SortIcon column="vendor_code" currentSort={filters.sortBy} currentOrder={filters.sortOrder} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <button type="button" onClick={() => toggleSort('vendor_name')} className="flex items-center gap-1 hover:text-gray-700">
                      Nama
                      <SortIcon column="vendor_name" currentSort={filters.sortBy} currentOrder={filters.sortOrder} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipe</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">PIC</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kontak</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{v.vendor_code}</td>
                    <td className="px-4 py-3 font-medium">{v.vendor_name}</td>
                    <td className="px-4 py-3">
                      {v.vendor_type ? (
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                          {VENDOR_TYPE_LABELS[v.vendor_type]}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {v.contact_person || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {v.phone && <p>{v.phone}</p>}
                      {v.email && <p>{v.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.is_active ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => navigate(`/finance/general-invoices/vendors/${v.id}/edit`)}
                          className="p-1.5 rounded-md hover:bg-gray-100" title="Edit vendor"><Edit2 size={13} /></button>
                        <button type="button" onClick={() => setDeleteTarget(v)}
                          className="p-1.5 rounded-md text-red-400 hover:bg-red-50" title="Hapus vendor"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Hal {filters.page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={filters.page === 1} onClick={() => setPage(filters.page - 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40">← Prev</button>
            <button type="button" disabled={filters.page === totalPages} onClick={() => setPage(filters.page + 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      <VendorFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold">Hapus Vendor?</h3>
            <p className="text-sm text-gray-600">
              Vendor <strong>{deleteTarget.vendor_name}</strong> akan dihapus.
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border rounded-lg">Batal</button>
              <button
                type="button"
                onClick={async () => {
                  await deleteMutation.mutateAsync(deleteTarget.id)
                  setDeleteTarget(null)
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
