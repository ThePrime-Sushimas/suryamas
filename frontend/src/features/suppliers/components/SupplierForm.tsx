import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SUPPLIER_TYPE_OPTIONS, RATING_OPTIONS } from '../constants/supplier.constants'
import type { CreateSupplierDto, UpdateSupplierDto, SupplierType, Supplier } from '../types/supplier.types'
import type { MinimalPaymentTerm } from '@/features/payment-terms/types'
import { paymentTermsApi } from '@/features/payment-terms/api/paymentTerms.api'

interface SupplierFormProps {
  initialData?: Supplier
  onSubmit: (data: CreateSupplierDto | UpdateSupplierDto) => Promise<void>
  onCancel: () => void
  submitLabel: string
  isEdit?: boolean
  loading?: boolean
}

export function SupplierForm({ initialData, onSubmit, onCancel, submitLabel, isEdit, loading }: SupplierFormProps) {
  const [submitting, setSubmitting] = useState(false)

  const { data: paymentTerms = [], isLoading: loadingTerms } = useQuery({
    queryKey: ['payment-terms', 'active'],
    queryFn: () => paymentTermsApi.minimalActive() as Promise<MinimalPaymentTerm[]>,
    staleTime: 5 * 60_000,
  })

  const [formData, setFormData] = useState<CreateSupplierDto>({
    supplier_code: initialData?.supplier_code || '',
    supplier_name: initialData?.supplier_name || '',
    supplier_type: (initialData?.supplier_type || 'vegetables') as SupplierType,
    contact_person: initialData?.contact_person || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    province: initialData?.province || '',
    postal_code: initialData?.postal_code || '',
    tax_id: initialData?.tax_id || '',
    business_license: initialData?.business_license || '',
    payment_term_id: initialData?.payment_term_id || undefined,
    lead_time_days: initialData?.lead_time_days || 1,
    minimum_order: initialData?.minimum_order || 0,
    rating: initialData?.rating || undefined,
    is_active: initialData?.is_active ?? true,
    notes: initialData?.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const submitData = { ...formData }
      if (submitData.email === '') delete submitData.email
      if (submitData.postal_code === '') delete submitData.postal_code
      if (submitData.tax_id === '') delete submitData.tax_id
      if (submitData.business_license === '') delete submitData.business_license
      if (submitData.notes === '') delete submitData.notes
      if (submitData.payment_term_id === undefined) delete submitData.payment_term_id
      if (submitData.rating === undefined) delete submitData.rating

      if (isEdit) {
        const { supplier_code: _, ...updateData } = submitData
        await onSubmit(updateData)
      } else {
        await onSubmit(submitData)
      }
    } finally { setSubmitting(false) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type, value } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else if (type === 'number' || name === 'payment_term_id' || name === 'rating') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : Number(value) }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      {/* Informasi Dasar */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Dasar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Kode Supplier *</label>
            <input type="text" name="supplier_code" value={formData.supplier_code} onChange={handleChange} required disabled={isEdit}
              className={`${inputCls} ${isEdit ? 'disabled:bg-gray-100 dark:disabled:bg-gray-800 cursor-not-allowed' : ''}`} />
            {isEdit && <p className="text-xs text-gray-400 mt-1">Kode tidak bisa diubah</p>}
          </div>
          <div>
            <label className={labelCls}>Nama Supplier *</label>
            <input type="text" name="supplier_name" value={formData.supplier_name} onChange={handleChange} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tipe Supplier *</label>
            <select name="supplier_type" value={formData.supplier_type} onChange={handleChange} required className={inputCls}>
              {SUPPLIER_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Rating</label>
            <select name="rating" value={formData.rating || ''} onChange={handleChange} className={inputCls}>
              <option value="">Belum dinilai</option>
              {RATING_OPTIONS.map(r => <option key={r} value={r}>{'⭐'.repeat(r)} ({r})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Kontak */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Kontak</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nama Kontak *</label>
            <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telepon *</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="+628123456789" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Alamat *</label>
            <textarea name="address" value={formData.address} onChange={handleChange} required rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Kota *</label>
            <input type="text" name="city" value={formData.city} onChange={handleChange} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Provinsi *</label>
            <input type="text" name="province" value={formData.province} onChange={handleChange} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Kode Pos</label>
            <input type="text" name="postal_code" value={formData.postal_code} onChange={handleChange} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Bisnis */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Bisnis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>NPWP</label>
            <input type="text" name="tax_id" value={formData.tax_id} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Izin Usaha</label>
            <input type="text" name="business_license" value={formData.business_license} onChange={handleChange} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Pembayaran & Ketentuan */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Pembayaran & Ketentuan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Termin Pembayaran</label>
            <select name="payment_term_id" value={formData.payment_term_id || ''} onChange={handleChange} disabled={loadingTerms} className={inputCls}>
              <option value="">{loadingTerms ? 'Memuat...' : 'Tidak ada'}</option>
              {paymentTerms.map(t => <option key={t.id} value={t.id}>{t.term_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Lead Time (Hari)</label>
            <input type="number" name="lead_time_days" value={formData.lead_time_days} onChange={handleChange} min={0} max={365} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Minimum Order</label>
            <input type="number" name="minimum_order" value={formData.minimum_order} onChange={handleChange} min={0} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Status & Catatan */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
        <label className="flex items-center cursor-pointer">
          <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange}
            className="mr-2 w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Aktif</span>
        </label>
        <div>
          <label className={labelCls}>Catatan</label>
          <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputCls} />
        </div>
      </div>

      {/* Aksi */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button type="button" onClick={onCancel} disabled={submitting}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50">
          Batal
        </button>
        <button type="submit" disabled={loading || submitting}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {submitting ? 'Menyimpan...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
