import { useState, useEffect } from 'react'
import { paymentTermsApi } from '@/features/payment-terms/api/paymentTerms.api'
import { useToast } from '@/contexts/ToastContext'
import { SUPPLIER_TYPE_OPTIONS, RATING_OPTIONS } from '../constants/supplier.constants'
import type { CreateSupplierDto, UpdateSupplierDto, SupplierType, Supplier } from '../types/supplier.types'
import type { MinimalPaymentTerm } from '@/features/payment-terms/types'

interface SupplierFormProps {
  initialData?: Supplier
  onSubmit: (data: CreateSupplierDto | UpdateSupplierDto) => Promise<void>
  onCancel: () => void
  submitLabel: string
  isEdit?: boolean
  loading?: boolean
}

export function SupplierForm({ initialData, onSubmit, onCancel, submitLabel, isEdit, loading }: SupplierFormProps) {
  const toast = useToast()
  const [paymentTerms, setPaymentTerms] = useState<MinimalPaymentTerm[]>([])
  const [paymentTermsLoading, setPaymentTermsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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

  useEffect(() => {
    setPaymentTermsLoading(true)
    paymentTermsApi.minimalActive()
      .then(setPaymentTerms)
      .catch(() => toast.error('Failed to load payment terms'))
      .finally(() => setPaymentTermsLoading(false))
  }, [toast])

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { supplier_code, ...updateData } = submitData
        await onSubmit(updateData)
      } else {
        await onSubmit(submitData)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type, value } = e.target
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : Number(value) }))
    } else if (name === 'payment_term_id' || name === 'rating') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : Number(value) }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Basic Info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier Code *
            </label>
            <input
              type="text"
              name="supplier_code"
              value={formData.supplier_code}
              onChange={handleChange}
              required
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            {isEdit && <p className="text-xs text-gray-500 mt-1">Code cannot be changed</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label>
            <input type="text" name="supplier_name" value={formData.supplier_name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Type *</label>
            <select name="supplier_type" value={formData.supplier_type} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              {SUPPLIER_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <select name="rating" value={formData.rating || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">No rating</option>
              {RATING_OPTIONS.map(r => <option key={r} value={r}>{'⭐'.repeat(r)} ({r})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
            <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required pattern="^\+?[0-9]{10,15}$" placeholder="+628123456789" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
            <textarea name="address" value={formData.address} onChange={handleChange} required rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
            <input type="text" name="city" value={formData.city} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
            <input type="text" name="province" value={formData.province} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
            <input type="text" name="postal_code" value={formData.postal_code} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Business Info */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Business Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
            <input type="text" name="tax_id" value={formData.tax_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business License</label>
            <input type="text" name="business_license" value={formData.business_license} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Payment & Terms */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment & Terms</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Term</label>
            <select name="payment_term_id" value={formData.payment_term_id || ''} onChange={handleChange} disabled={paymentTermsLoading} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
              <option value="">{paymentTermsLoading ? 'Loading...' : 'None'}</option>
              {paymentTerms.map(t => <option key={t.id} value={t.id}>{t.term_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (Days)</label>
            <input type="number" name="lead_time_days" value={formData.lead_time_days} onChange={handleChange} min={0} max={365} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Order</label>
            <input type="number" name="minimum_order" value={formData.minimum_order} onChange={handleChange} min={0} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Status & Notes */}
      <div className="border-t pt-4">
        <div className="space-y-4">
          <div>
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="mr-2 w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={loading || submitting} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
