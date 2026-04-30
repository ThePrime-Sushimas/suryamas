import { useState, useEffect } from 'react'
import type { SubCategory, CreateSubCategoryDto, UpdateSubCategoryDto } from '../types'
import { useCategoriesStore } from '../store/categories.store'
import { subCategoriesApi } from '../api/categories.api'

interface SubCategoryFormProps {
  initialData?: SubCategory
  isEdit?: boolean
  onSubmit: (data: CreateSubCategoryDto | UpdateSubCategoryDto) => Promise<void>
  isLoading?: boolean
}

export const SubCategoryForm = ({ initialData, isEdit, onSubmit, isLoading }: SubCategoryFormProps) => {
  const { categories, fetchAllCategories } = useCategoriesStore()
  const [formData, setFormData] = useState({
    category_id: initialData?.category_id || '',
    sub_category_code: initialData?.sub_category_code || '',
    sub_category_name: initialData?.sub_category_name || '',
    description: initialData?.description || '',
    sort_order: initialData?.sort_order || 0,
  })
  const [existingCodes, setExistingCodes] = useState<string[]>([])

  useEffect(() => {
    fetchAllCategories()
  }, [fetchAllCategories])

  useEffect(() => {
    if (formData.category_id && !isEdit) {
      subCategoriesApi.getByCategoryId(formData.category_id)
        .then(subs => setExistingCodes(subs.map(s => s.sub_category_code)))
        .catch(() => setExistingCodes([]))
    }
  }, [formData.category_id, isEdit])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(isEdit ? {
      sub_category_name: formData.sub_category_name,
      description: formData.description,
      sort_order: Number(formData.sort_order),
    } : formData)
  }

  const isDuplicateCode = !isEdit && existingCodes.includes(formData.sub_category_code)
  const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori *</label>
            <select name="category_id" value={formData.category_id} onChange={handleChange} className={inputClass} required>
              <option value="">Pilih Kategori</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.category_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode Sub-Kategori *</label>
            <input
              name="sub_category_code"
              value={formData.sub_category_code}
              onChange={handleChange}
              className={`${inputClass} ${isDuplicateCode ? 'border-red-500' : ''}`}
              required
            />
            {isDuplicateCode && (
              <p className="text-red-500 text-sm mt-1">Kode sudah digunakan untuk kategori ini</p>
            )}
          </div>
        </>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Sub-Kategori *</label>
        <input name="sub_category_name" value={formData.sub_category_name} onChange={handleChange} className={inputClass} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
        <textarea name="description" value={formData.description} onChange={handleChange} className={inputClass} rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Urutan</label>
        <input type="number" name="sort_order" value={formData.sort_order} onChange={handleChange} className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={isLoading || isDuplicateCode}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Menyimpan...' : isEdit ? 'Perbarui' : 'Buat'}
      </button>
    </form>
  )
}
