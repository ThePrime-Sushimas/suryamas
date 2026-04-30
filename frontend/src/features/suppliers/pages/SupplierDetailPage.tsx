import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Edit2 } from 'lucide-react'
import { suppliersApi } from '../api/suppliers.api'
import { useToast } from '@/contexts/ToastContext'
import { SupplierStatusBadge } from '../components/SupplierStatusBadge'
import { SupplierTypeBadge } from '../components/SupplierTypeBadge'
import { BankAccountsSection } from '@/features/bank-accounts'
import type { Supplier } from '../types/supplier.types'

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'bank-accounts'>('overview')

  useEffect(() => {
    if (!id) {
      toast.error('ID supplier tidak valid')
      navigate('/suppliers')
      return
    }

    suppliersApi.getById(id)
      .then(setSupplier)
      .catch(() => {
        toast.error('Gagal memuat data supplier')
        navigate('/suppliers')
      })
      .finally(() => setLoading(false))
  }, [id, navigate, toast])

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="p-6 grid grid-cols-2 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!supplier) return null

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      <button
        onClick={() => navigate('/suppliers')}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 mb-6"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{supplier.supplier_name}</h1>
                <SupplierStatusBadge isActive={supplier.is_active} />
                <SupplierTypeBadge type={supplier.supplier_type} />
              </div>
              <p className="text-gray-600 dark:text-gray-400">{supplier.supplier_code}</p>
            </div>
            <Link
              to={`/suppliers/${supplier.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Ringkasan
            </button>
            <button
              onClick={() => setActiveTab('bank-accounts')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'bank-accounts'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Rekening Bank
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Kode Supplier</h3>
                <p className="text-gray-900 dark:text-white">{supplier.supplier_code}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Nama Supplier</h3>
                <p className="text-gray-900 dark:text-white">{supplier.supplier_name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tipe</h3>
                <SupplierTypeBadge type={supplier.supplier_type} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</h3>
                <SupplierStatusBadge isActive={supplier.is_active} />
              </div>
              {supplier.contact_person && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Kontak</h3>
                  <p className="text-gray-900 dark:text-white">{supplier.contact_person}</p>
                </div>
              )}
              {supplier.phone && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Telepon</h3>
                  <p className="text-gray-900 dark:text-white">{supplier.phone}</p>
                </div>
              )}
              {supplier.email && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</h3>
                  <p className="text-gray-900 dark:text-white">{supplier.email}</p>
                </div>
              )}
              {supplier.address && (
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Alamat</h3>
                  <p className="text-gray-900 dark:text-white">{supplier.address}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bank-accounts' && (
            <BankAccountsSection ownerType="supplier" ownerId={String(supplier.id)} />
          )}
        </div>
      </div>
    </div>
  )
}
