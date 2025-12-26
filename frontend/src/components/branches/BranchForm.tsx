import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Branch, CreateBranchDto, UpdateBranchDto } from '@/types/branch'
import type { Company } from '@/types/company'
import { companyService } from '@/services/companyService'
import { useEmployeeStore } from '@/stores/employeeStore'
import { DAYS_OF_WEEK, BRANCH_STATUS } from '@/constants/branches.constants'
import { useState } from 'react'

const branchSchema = z.object({
  company_id: z.string().uuid('Invalid company'),
  branch_code: z.string().min(1, 'Branch code required'),
  branch_name: z.string().min(1, 'Branch name required'),
  address: z.string().min(1, 'Address required'),
  city: z.string().min(1, 'City required'),
  province: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  jam_buka: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  jam_tutup: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  hari_operasional: z.array(z.string()).min(1, 'Select at least one day'),
  status: z.enum(['active', 'inactive']),
  manager_id: z.string().optional(),
  notes: z.string().optional(),
})

type BranchFormData = z.infer<typeof branchSchema>

interface BranchFormProps {
  initialData?: Branch
  isEdit?: boolean
  onSubmit: (data: CreateBranchDto | UpdateBranchDto) => Promise<void>
  isLoading?: boolean
}

export const BranchForm = ({ initialData, isEdit, onSubmit, isLoading }: BranchFormProps) => {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const { searchEmployees, employees, isLoading: employeesLoading } = useEmployeeStore()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      company_id: initialData?.company_id ?? '',
      branch_code: initialData?.branch_code || '',
      branch_name: initialData?.branch_name || '',
      address: initialData?.address || '',
      city: initialData?.city || '',
      province: initialData?.province || 'DKI Jakarta',
      postal_code: initialData?.postal_code || '',
      country: initialData?.country || 'Indonesia',
      phone: initialData?.phone || '',
      whatsapp: initialData?.whatsapp || '',
      email: initialData?.email || '',
      jam_buka: initialData?.jam_buka?.slice(0, 5) || '10:00',
      jam_tutup: initialData?.jam_tutup?.slice(0, 5) || '22:00',
      hari_operasional: Array.isArray(initialData?.hari_operasional) ? initialData.hari_operasional : [],
      status: initialData?.status || BRANCH_STATUS.ACTIVE,
      manager_id: initialData?.manager_id || '',
      notes: initialData?.notes || '',
    },
  })

  const hariOperasional = watch('hari_operasional')

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await companyService.list(1, 1000)
        setCompanies(res.data.data)
      } catch (error) {
        setCompanies([])
      } finally {
        setCompaniesLoading(false)
      }
    }
    fetchCompanies()
  }, [])

  useEffect(() => {
    searchEmployees('', 'full_name', 'asc', {}, 1, 1000)
  }, [searchEmployees])

  const handleHariChange = (hari: string) => {
    const current = hariOperasional || []
    if (current.includes(hari)) {
      setValue('hari_operasional', current.filter(h => h !== hari))
    } else {
      setValue('hari_operasional', [...current, hari])
    }
  }

  const onFormSubmit = async (data: BranchFormData) => {
    const submitData = isEdit
      ? {
          branch_name: data.branch_name,
          address: data.address,
          city: data.city,
          province: data.province,
          postal_code: data.postal_code || undefined,
          country: data.country,
          phone: data.phone || undefined,
          whatsapp: data.whatsapp || undefined,
          email: data.email || undefined,
          jam_buka: data.jam_buka + ':00',
          jam_tutup: data.jam_tutup + ':00',
          hari_operasional: data.hari_operasional,
          status: data.status,
          manager_id: data.manager_id || undefined,
          notes: data.notes || undefined,
        }
      : {
          company_id: data.company_id,
          branch_code: data.branch_code,
          branch_name: data.branch_name,
          address: data.address,
          city: data.city,
          province: data.province,
          postal_code: data.postal_code || undefined,
          country: data.country,
          phone: data.phone || undefined,
          whatsapp: data.whatsapp || undefined,
          email: data.email || undefined,
          jam_buka: data.jam_buka + ':00',
          jam_tutup: data.jam_tutup + ':00',
          hari_operasional: data.hari_operasional,
          status: data.status,
          manager_id: data.manager_id || undefined,
          notes: data.notes || undefined,
        }

    await onSubmit(submitData as any)
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div>
        <label htmlFor="company_id" className="block text-sm font-medium text-gray-700 mb-2">
          Company <span className="text-red-500">*</span>
        </label>
        <select
          id="company_id"
          {...register('company_id')}
          disabled={isEdit || companiesLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-required="true"
          aria-invalid={!!errors.company_id}
        >
          <option value="">Select Company</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        {errors.company_id && <p className="text-red-500 text-xs mt-1" role="alert">{errors.company_id.message}</p>}
      </div>

      <div>
        <label htmlFor="branch_code" className="block text-sm font-medium text-gray-700 mb-2">
          Branch Code <span className="text-red-500">*</span>
        </label>
        <input
          id="branch_code"
          type="text"
          {...register('branch_code')}
          disabled={isEdit}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-required="true"
          aria-invalid={!!errors.branch_code}
        />
        {errors.branch_code && <p className="text-red-500 text-xs mt-1" role="alert">{errors.branch_code.message}</p>}
      </div>

      <div>
        <label htmlFor="branch_name" className="block text-sm font-medium text-gray-700 mb-2">
          Branch Name <span className="text-red-500">*</span>
        </label>
        <input
          id="branch_name"
          type="text"
          {...register('branch_name')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-required="true"
          aria-invalid={!!errors.branch_name}
        />
        {errors.branch_name && <p className="text-red-500 text-xs mt-1" role="alert">{errors.branch_name.message}</p>}
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
          Address <span className="text-red-500">*</span>
        </label>
        <textarea
          id="address"
          {...register('address')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          aria-required="true"
          aria-invalid={!!errors.address}
        />
        {errors.address && <p className="text-red-500 text-xs mt-1" role="alert">{errors.address.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
            City <span className="text-red-500">*</span>
          </label>
          <input
            id="city"
            type="text"
            {...register('city')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-required="true"
          />
          {errors.city && <p className="text-red-500 text-xs mt-1" role="alert">{errors.city.message}</p>}
        </div>
        <div>
          <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-2">Province</label>
          <input
            id="province"
            type="text"
            {...register('province')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
          <input
            id="postal_code"
            type="text"
            {...register('postal_code')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">Country</label>
          <input
            id="country"
            type="text"
            {...register('country')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
          <input
            id="phone"
            type="tel"
            {...register('phone')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-2">WhatsApp</label>
          <input
            id="whatsapp"
            type="tel"
            {...register('whatsapp')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1" role="alert">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="jam_buka" className="block text-sm font-medium text-gray-700 mb-2">
            Opening Time <span className="text-red-500">*</span>
          </label>
          <input
            id="jam_buka"
            type="time"
            {...register('jam_buka')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-required="true"
          />
          {errors.jam_buka && <p className="text-red-500 text-xs mt-1" role="alert">{errors.jam_buka.message}</p>}
        </div>
        <div>
          <label htmlFor="jam_tutup" className="block text-sm font-medium text-gray-700 mb-2">
            Closing Time <span className="text-red-500">*</span>
          </label>
          <input
            id="jam_tutup"
            type="time"
            {...register('jam_tutup')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-required="true"
          />
          {errors.jam_tutup && <p className="text-red-500 text-xs mt-1" role="alert">{errors.jam_tutup.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Operating Days <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2" role="group" aria-label="Operating days">
          {DAYS_OF_WEEK.map(hari => (
            <label key={hari} className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={hariOperasional?.includes(hari) || false}
                onChange={() => handleHariChange(hari)}
                className="mr-2 cursor-pointer w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                aria-label={hari}
              />
              <span className="text-sm">{hari}</span>
            </label>
          ))}
        </div>
        {errors.hari_operasional && <p className="text-red-500 text-xs mt-1" role="alert">{errors.hari_operasional.message}</p>}
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
          Status <span className="text-red-500">*</span>
        </label>
        <select
          id="status"
          {...register('status')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-required="true"
        >
          <option value={BRANCH_STATUS.ACTIVE}>Active</option>
          <option value={BRANCH_STATUS.INACTIVE}>Inactive</option>
        </select>
      </div>

      <div>
        <label htmlFor="manager_id" className="block text-sm font-medium text-gray-700 mb-2">Manager</label>
        <select
          id="manager_id"
          {...register('manager_id')}
          disabled={employeesLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select Manager (Optional)</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.job_position})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          id="notes"
          {...register('notes')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-busy={isLoading}
      >
        {isLoading ? 'Saving...' : isEdit ? 'Update Branch' : 'Create Branch'}
      </button>
    </form>
  )
}
