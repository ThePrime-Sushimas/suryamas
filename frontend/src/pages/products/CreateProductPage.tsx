import { useState, useEffect } from 'react'
import { productService } from '../../services/productService'
import { categoryService, subCategoryService } from '../../services/categoryService'
import { metricUnitService } from '../../services/metricUnitService'
import { ProductForm } from '../../components/products/ProductForm'
import { UomForm } from '../../components/products/UomForm'
import { UomTable } from '../../components/products/UomTable'
import type { CreateProductDto, ProductUom, CreateProductUomDto } from '../../types/product'
import { Plus } from 'lucide-react'

export const CreateProductPage = () => {
  const [categories, setCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)
  const [uoms, setUoms] = useState<ProductUom[]>([])
  const [showUomForm, setShowUomForm] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setDataLoading(true)
      const [catRes, subCatRes, unitRes] = await Promise.allSettled([
        categoryService.list(1, 1000),
        subCategoryService.list(1, 1000),
        metricUnitService.list(1, 1000),
      ])

      if (catRes.status === 'fulfilled') {
        setCategories(catRes.value.data?.data || [])
      } else {
        console.error('Categories failed:', catRes.reason)
      }

      if (subCatRes.status === 'fulfilled') {
        setSubCategories(subCatRes.value.data?.data || [])
      } else {
        console.error('SubCategories failed:', subCatRes.reason)
      }

      if (unitRes.status === 'fulfilled') {
        // metricUnits loaded but not used in create flow
      } else {
        console.error('MetricUnits failed:', unitRes.reason)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const handleCancel = () => {
    setCreatedProductId(null)
    setUoms([])
    setShowUomForm(false)
  }

  const handleSubmit = async (data: CreateProductDto | any) => {
    try {
      setSubmitting(true)
      const response = await productService.create(data)
      const productId = response.data.data.id
      setCreatedProductId(productId)
    } catch (error) {
      console.error('Create failed:', error)
      alert('Failed to create product')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateUom = async (data: CreateProductUomDto | any) => {
    if (!createdProductId) return
    try {
      await productService.createUom(createdProductId, data)
      setShowUomForm(false)
      loadUoms()
    } catch (error) {
      console.error('Create UOM failed:', error)
      alert('Failed to create UOM')
    }
  }

  const loadUoms = async () => {
    if (!createdProductId) return
    try {
      const response = await productService.getUoms(createdProductId)
      setUoms(response.data.data)
    } catch (error) {
      console.error('Failed to load UOMs:', error)
    }
  }

  const handleDeleteUom = async (uomId: string) => {
    if (!createdProductId || !confirm('Delete this UOM?')) return
    try {
      await productService.deleteUom(createdProductId, uomId)
      loadUoms()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleUpdateDefault = async (uomId: string, field: string, value: boolean) => {
    if (!createdProductId) return
    try {
      await productService.updateUom(createdProductId, uomId, { [field]: value })
      loadUoms()
    } catch (error) {
      console.error('Update failed:', error)
    }
  }

  if (dataLoading) return <div className="p-6">Loading...</div>

  const hasBaseUnit = uoms.some(u => u.is_base_unit)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create Product - New</h1>

      <div className="bg-white p-6 rounded shadow space-y-6">
        <ProductForm
          categories={categories}
          subCategories={subCategories}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </div>

      <div className="bg-white p-6 rounded shadow space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Product Detail</h2>
          <button
            onClick={() => setShowUomForm(!showUomForm)}
            className="bg-teal-600 text-white px-3 py-2 rounded flex items-center gap-2 hover:bg-teal-700"
          >
            <Plus size={18} /> Add Unit
          </button>
        </div>

        {showUomForm && (
          <div className="border-t pt-4">
            <UomForm
              onSubmit={handleCreateUom}
              hasBaseUnit={hasBaseUnit}
            />
          </div>
        )}

        {uoms.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No UOMs defined</p>
        ) : (
          <UomTable
            uoms={uoms}
            onDelete={handleDeleteUom}
            onEdit={() => {}}
            onUpdateDefault={handleUpdateDefault}
          />
        )}
      </div>
    </div>
  )
}
