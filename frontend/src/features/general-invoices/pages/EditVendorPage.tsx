import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { BankAccountsSection } from '@/features/bank-accounts/components/BankAccountsSection'
import { useVendor, useUpdateVendor } from '../api/generalApi.api'
import { VENDOR_TYPE_OPTIONS } from '../constants'
import type { VendorType } from '../api/generalApi.api'

export default function EditVendorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const writeCompanyId = useBranchContextStore(
    (s) => s.currentBranch?.company_id ?? s.branches[0]?.company_id,
  )

  const { data: vendor, isLoading: loadingVendor } = useVendor(id ?? '')
  const updateMutation = useUpdateVendor()

  const [form, setForm] = useState({
    vendor_code: '',
    vendor_name: '',
    vendor_type: '' as VendorType | '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    is_active: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (vendor) {
      setForm({
        vendor_code: vendor.vendor_code,
        vendor_name: vendor.vendor_name,
        vendor_type: vendor.vendor_type ?? '',
        contact_person: vendor.contact_person ?? '',
        phone: vendor.phone ?? '',
        email: vendor.email ?? '',
        address: vendor.address ?? '',
        notes: vendor.notes ?? '',
        is_active: vendor.is_active,
      })
    }
  }, [vendor?.id])

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
    if (!validate() || !id) return
    await updateMutation.mutateAsync({
      id,
      body: {
        vendor_code: form.vendor_code,
        vendor_name: form.vendor_name,
        vendor_type: form.vendor_type || null,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
        is_active: form.is_active,
      },
    })
    navigate('/finance/general-invoices/vendors')
  }

  if (loadingVendor) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="p-6 text-center text-gray-500">
        Vendor tidak ditemukan.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/finance/general-invoices/vendors')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Edit Vendor</h1>
          <p className="text-sm text-gray-500">{vendor.vendor_code} — {vendor.vendor_name}</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Informasi Vendor</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          {errors.vendor_name && <p className="text-xs text-red-500">{errors.vendor_name}</p>}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Telepon</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="Telepon"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="Email"
              className={`w-full px-3 py-2 text-sm border rounded-lg ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">Alamat</label>
          <textarea
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            rows={2}
            placeholder="Alamat"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">Catatan</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Catatan"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
          />
          <span className="text-sm text-gray-700">Vendor Aktif</span>
        </label>
      </div>

      {/* Bank Accounts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Rekening Bank</h2>
        <p className="text-xs text-gray-500">
          Rekening untuk transfer ke vendor.
        </p>
        <BankAccountsSection
          ownerType="vendor"
          ownerId={id!}
          companyId={writeCompanyId}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => navigate('/finance/general-invoices/vendors')}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {updateMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Simpan
        </button>
      </div>
    </div>
  )
}
