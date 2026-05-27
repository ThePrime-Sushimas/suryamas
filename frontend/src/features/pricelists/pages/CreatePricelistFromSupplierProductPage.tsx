import { useEffect, useState, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { supplierProductsApi } from '@/features/supplier-products'
import { useCreatePricelist } from '../api/pricelists.api'
import { PricelistFormContextual } from '../components/PricelistFormContextual'
import type { CreatePricelistDto, UpdatePricelistDto } from '../types/pricelist.types'

interface SupplierProductContext {
  id: string
  supplier_id: string
  product_id: string
  supplier?: { supplier_name: string }
  product?: { product_name: string }
}

export const CreatePricelistFromSupplierProductPage = memo(function CreatePricelistFromSupplierProductPage() {
  const { supplierProductId } = useParams<{ supplierProductId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const branches = useBranchContextStore(s => s.branches)
  const writeCompanyId = currentBranch?.company_id || branches.find(b => b.company_id)?.company_id || ''
  const createPL = useCreatePricelist()

  const [supplierProduct, setSupplierProduct] = useState<SupplierProductContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const [contextError, setContextError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const fetchContext = async () => {
      if (!supplierProductId) { setContextError('Invalid supplier product ID'); setContextLoading(false); return }

      try {
        const data = await supplierProductsApi.getById(supplierProductId, true, false, controller.signal)
        if (!controller.signal.aborted) { setSupplierProduct(data); setContextError(null) }
      } catch {
        if (!controller.signal.aborted) setContextError('Failed to load supplier product context')
      } finally {
        if (!controller.signal.aborted) setContextLoading(false)
      }
    }

    fetchContext()
    return () => controller.abort()
  }, [supplierProductId])

  const handleSubmit = useCallback(async (data: CreatePricelistDto | UpdatePricelistDto) => {
    if (!supplierProduct) { toast.error('Missing required context'); return }
    if (!writeCompanyId) { toast.error('Pilih cabang di header untuk menentukan perusahaan'); return }
    try {
      await createPL.mutateAsync({ ...(data as CreatePricelistDto), company_id: writeCompanyId })
      toast.success('Pricelist berhasil dibuat')
      navigate(`/supplier-products/${supplierProductId}/pricelists`)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat pricelist')) }
  }, [createPL, supplierProduct, writeCompanyId, toast, navigate, supplierProductId])

  const handleCancel = useCallback(() => {
    navigate(`/supplier-products/${supplierProductId}/pricelists`)
  }, [navigate, supplierProductId])

  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    )
  }

  if (contextError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Error</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">{contextError}</p>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Coba Lagi</button>
            <button onClick={() => navigate('/supplier-products')} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Kembali</button>
          </div>
        </div>
      </div>
    )
  }

  if (!supplierProduct) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Tidak Ditemukan</h2>
          <p className="text-yellow-600 dark:text-yellow-400 mb-4">Produk supplier tidak ditemukan</p>
          <button onClick={() => navigate('/supplier-products')} className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">Kembali</button>
        </div>
      </div>
    )
  }

  if (!writeCompanyId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Cabang diperlukan</h2>
          <p className="text-yellow-600 dark:text-yellow-400 mb-4">Pilih cabang di header untuk membuat pricelist (operasi tulis).</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">Pilih Branch</button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <li><button onClick={() => navigate('/supplier-products')} className="hover:text-blue-600 dark:hover:text-blue-400">Supplier Products</button></li>
          <li>/</li>
          <li><button onClick={() => navigate(`/supplier-products/${supplierProductId}/pricelists`)} className="hover:text-blue-600 dark:hover:text-blue-400">Pricelists</button></li>
          <li>/</li>
          <li className="text-gray-900 dark:text-white font-medium">Buat Baru</li>
        </ol>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buat Pricelist</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Tambah harga baru untuk {supplierProduct.supplier?.supplier_name} - {supplierProduct.product?.product_name}
        </p>
      </div>

      <div className="max-w-4xl">
        <PricelistFormContextual
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Buat Pricelist"
          submitting={createPL.isPending}
          companyId={writeCompanyId}
          supplierId={supplierProduct.supplier_id}
          productId={supplierProduct.product_id}
          supplierName={supplierProduct.supplier?.supplier_name}
          productName={supplierProduct.product?.product_name}
        />
      </div>
    </div>
  )
})
