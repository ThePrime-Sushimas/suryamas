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
    const loadData = async () => {
      if (!id) {
        toast.error('Invalid supplier ID')
        navigate('/suppliers')
        return
      }

      try {
        const data = await suppliersApi.getById(id)
        setSupplier(data)
      } catch (error) {
        console.error('Failed to load supplier:', error)
        toast.error('Failed to load supplier')
        navigate('/suppliers')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [id, navigate, toast])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!supplier) {
    return null
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button
        onClick={() => navigate('/suppliers')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Suppliers
      </button>

      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{supplier.supplier_name}</h1>
                <SupplierStatusBadge isActive={supplier.is_active} />
                <SupplierTypeBadge type={supplier.supplier_type} />
              </div>
              <p className="text-gray-600">{supplier.supplier_code}</p>
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
        <div className="border-b">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('bank-accounts')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'bank-accounts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Bank Accounts
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Supplier Code</h3>
                <p className="text-gray-900">{supplier.supplier_code}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Supplier Name</h3>
                <p className="text-gray-900">{supplier.supplier_name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Type</h3>
                <SupplierTypeBadge type={supplier.supplier_type} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                <SupplierStatusBadge isActive={supplier.is_active} />
              </div>
              {supplier.contact_person && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Contact Person</h3>
                  <p className="text-gray-900">{supplier.contact_person}</p>
                </div>
              )}
              {supplier.phone && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
                  <p className="text-gray-900">{supplier.phone}</p>
                </div>
              )}
              {supplier.email && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
                  <p className="text-gray-900">{supplier.email}</p>
                </div>
              )}
              {supplier.address && (
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Address</h3>
                  <p className="text-gray-900">{supplier.address}</p>
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
