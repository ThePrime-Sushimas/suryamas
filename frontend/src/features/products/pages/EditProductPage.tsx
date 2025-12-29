import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { productsApi } from '../api/products.api'
import { useProductsStore } from '../store/products.store'
import { ProductForm } from '../components/ProductForm'
import type { Product } from '../types'
import { useToast } from '@/contexts/ToastContext'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateProduct, loading: updating } = useProductsStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const { success, error } = useToast()

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await productsApi.getById(id || '')
        setProduct(data)
      } catch (err) {
        error('Product not found')
        navigate('/products')
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id, navigate, error])

  const handleSubmit = async (data: any) => {
    try {
      await updateProduct(id || '', data)
      success('Product updated successfully')
      navigate('/products')
    } catch (err: any) {
      error(err.response?.data?.error || 'Failed to update product')
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!product) return <div className="p-4 text-red-600">Product not found</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Product</h1>
      <ProductForm initialData={product} isEdit onSubmit={handleSubmit} isLoading={updating} />
    </div>
  )
}
