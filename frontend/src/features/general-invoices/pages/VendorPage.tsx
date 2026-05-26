import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Search, Building2, X } from 'lucide-react'
import {
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
} from '../api/generalApi.api'
import { VENDOR_TYPE_LABELS, VENDOR_TYPE_OPTIONS } from '../constants'
import type { Vendor, VendorType } from '../api/generalApi.api'


// ─── Vendor Form Modal ────────────────────────────────────────
interface VendorFormModalProps {
  open: boolean
  onClose: () => void
  vendor?: Vendor | null
}

function VendorFormModal({ open, onClose, vendor }: VendorFormModalProps) {
  const isEdit = !!vendor
  const createMutation = useCreateVendor()
  const updateMutation = useUpdateVendor()

  const [form, setForm] = useState({
    vendor_code: '',
    vendor_name: '',
    vendor_type: '' as VendorType | '',
    phone: '',
    email: '',
    address: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
    notes: '',
    is_active: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Populate when editing
  useEffect(() => {
    if (!open) return
    if (vendor) {
      setForm({
        vendor_code: vendor.vendor_code,
        vendor_name: vendor.vendor_name,
        vendor_type: vendor.vendor_type ?? '',
        phone: vendor.phone ?? '',
        email: vendor.email ?? '',
        address: vendor.address ?? '',
        bank_name: vendor.bank_name ?? '',
        bank_account_number: vendor.bank_account_number ?? '',
        bank_account_name: vendor.bank_account_name ?? '',
        notes: vendor.notes ?? '',
        is_active: vendor.is_active,
      })
    } else {
      setForm({
        vendor_code: '',
        vendor_name: '',
        vendor_type: '',
        phone: '',
        email: '',
        address: '',
        bank_name: '',
        bank_account_number: '',
        bank_account_name: '',
        notes: '',
        is_active: true,
      })
    }
    setErrors({})
  }, [open, vendor])





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
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      bank_name: form.bank_name || undefined,
      bank_account_number: form.bank_account_number || undefined,
      bank_account_name: form.bank_account_name || undefined,
      notes: form.notes || undefined,
    }

    if (isEdit && vendor) {
      await updateMutation.mutateAsync({ id: vendor.id, body: { ...payload, is_active: form.is_active } })

    } else {
      await createMutation.mutateAsync(payload)
    }
    onClose()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Edit Vendor' : 'Tambah Vendor'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Code + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Kode Vendor *</label>
              <input
                type="text"
                value={form.vendor_code}
                onChange={(e) => set('vendor_code', e.target.value)}
                placeholder="UTIL-001"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.vendor_code ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.vendor_code && <p className="text-xs text-red-500">{errors.vendor_code}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Tipe</label>
              <select
                value={form.vendor_type}
                onChange={(e) => set('vendor_type', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              placeholder="PT. Contoh Vendor"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.vendor_name ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.vendor_name && <p className="text-xs text-red-500">{errors.vendor_name}</p>}
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Telepon</label>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-400' : 'border-gray-200'}`} />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Alamat</label>
            <textarea value={form.address} onChange={(e) => set('address', e.target.value)}
              rows={2} placeholder="Alamat vendor (opsional)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Bank info */}
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Info Bank</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Nama Bank</label>
                <input type="text" value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)}
                  placeholder="BCA, BRI, dll"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-600">No. Rekening</label>
                <input type="text" value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Nama Pemilik Rekening</label>
              <input type="text" value={form.bank_account_name} onChange={(e) => set('bank_account_name', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Notes + Status */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Catatan</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)}
                className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Vendor Aktif</span>
            </label>
          )}
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onClick={handleSubmit} disabled={isPending}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60">
            {isPending ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Tambah Vendor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Vendors Page ─────────────────────────────────────────────
export default function VendorsPage() {
  const [search, setSearch] = useState('')
  const [vendorType, setVendorType] = useState<VendorType | ''>('')
  const [isActive, setIsActive] = useState<boolean | undefined>(true)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Vendor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)

  const { data, isLoading } = useVendors({
    search: search || undefined,
    vendor_type: vendorType || undefined,
    is_active: isActive,
    page,
    limit: 50,
  })
  const deleteMutation = useDeleteVendor()

  const vendors = data?.data ?? []
  const totalPages = data?.pagination?.totalPages ?? 1


  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} vendor</p>

        </div>
        <button
          onClick={() => { setEditTarget(null); setFormOpen(true) }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> Tambah Vendor
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Cari nama atau kode vendor..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={vendorType} onChange={(e) => { setVendorType(e.target.value as VendorType | ''); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Semua Tipe</option>
          {VENDOR_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={isActive === undefined ? '' : String(isActive)}
          onChange={(e) => setIsActive(e.target.value === '' ? undefined : e.target.value === 'true')}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua</option>
          <option value="true">Aktif</option>
          <option value="false">Non-aktif</option>
        </select>
      </div>

      {/* List */}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kode</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipe</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kontak</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{v.vendor_code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{v.vendor_name}</td>
                    <td className="px-4 py-3">
                      {v.vendor_type ? (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {VENDOR_TYPE_LABELS[v.vendor_type]}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {v.phone && <p>{v.phone}</p>}
                      {v.email && <p>{v.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {v.bank_name ? (
                        <>
                          <p className="font-medium">{v.bank_name}</p>
                          <p>{v.bank_account_number}</p>
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.is_active ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditTarget(v); setFormOpen(true) }}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(v)}
                          className="p-1.5 rounded-md text-red-400 hover:bg-red-50"
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile list */}
        <div className="sm:hidden divide-y divide-gray-100">
          {vendors.map((v) => (
            <div key={v.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500">{v.vendor_code}</p>
                <p className="text-sm font-medium text-gray-900">{v.vendor_name}</p>
                {v.vendor_type && (
                  <p className="text-xs text-gray-400">{VENDOR_TYPE_LABELS[v.vendor_type]}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {v.is_active ? 'Aktif' : 'Off'}
                </span>
                <button onClick={() => { setEditTarget(v); setFormOpen(true) }}
                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md">
                  <Edit2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Hal {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
          </div>
        </div>
      )}

      {/* Modals */}
      <VendorFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        vendor={editTarget}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Hapus Vendor?</h3>
            <p className="text-sm text-gray-600">
              Vendor <strong>{deleteTarget.vendor_name}</strong> akan dihapus. Vendor yang sudah punya invoice tidak bisa dihapus.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
              <button
                onClick={async () => {
                  await deleteMutation.mutateAsync(deleteTarget.id)
                  setDeleteTarget(null)
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}