import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Branch, CreateBranchDto, UpdateBranchDto } from '@/types/branch'
import type { Company } from '@/types/company'
import { companyService } from '@/services/companyService'
import { useEmployeeStore } from '@/stores/employeeStore'
import { useState } from 'react'

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

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
      status: initialData?.status || 'active',
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
        console.error('Failed to fetch companies')
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
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Company</label>
        <select
          {...register('company_id')}
          disabled={isEdit || companiesLoading}
          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
        >
          <option value="">Select Company</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        {errors.company_id && <p className="text-red-500 text-xs mt-1">{errors.company_id.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Branch Code</label>
        <input
          type="text"
          {...register('branch_code')}
          disabled={isEdit}
          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
        />
        {errors.branch_code && <p className="text-red-500 text-xs mt-1">{errors.branch_code.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Branch Name</label>
        <input type="text" {...register('branch_name')} className="w-full px-3 py-2 border rounded-md" />
        {errors.branch_name && <p className="text-red-500 text-xs mt-1">{errors.branch_name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Address</label>
        <textarea {...register('address')} className="w-full px-3 py-2 border rounded-md" rows={3} />
        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">City</label>
          <input type="text" {...register('city')} className="w-full px-3 py-2 border rounded-md" />
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Province</label>
          <input type="text" {...register('province')} className="w-full px-3 py-2 border rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Postal Code</label>
          <input type="text" {...register('postal_code')} className="w-full px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium">Country</label>
          <input type="text" {...register('country')} className="w-full px-3 py-2 border rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input type="tel" {...register('phone')} className="w-full px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium">WhatsApp</label>
          <input type="tel" {...register('whatsapp')} className="w-full px-3 py-2 border rounded-md" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input type="email" {...register('email')} className="w-full px-3 py-2 border rounded-md" />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Jam Buka</label>
          <input type="time" {...register('jam_buka')} className="w-full px-3 py-2 border rounded-md" />
          {errors.jam_buka && <p className="text-red-500 text-xs mt-1">{errors.jam_buka.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Jam Tutup</label>
          <input type="time" {...register('jam_tutup')} className="w-full px-3 py-2 border rounded-md" />
          {errors.jam_tutup && <p className="text-red-500 text-xs mt-1">{errors.jam_tutup.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Hari Operasional</label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {HARI_LIST.map(hari => (
            <label key={hari} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hariOperasional?.includes(hari) || false}
                onChange={() => handleHariChange(hari)}
                className="mr-2 cursor-pointer w-4 h-4"
              />
              <span className="text-sm whitespace-nowrap">{hari}</span>
            </label>
          ))}
        </div>
        {errors.hari_operasional && <p className="text-red-500 text-xs mt-1">{errors.hari_operasional.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Status</label>
        <select {...register('status')} className="w-full px-3 py-2 border rounded-md">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Manager</label>
        <select {...register('manager_id')} disabled={employeesLoading} className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100">
          <option value="">Select Manager (Optional)</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.job_position})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea {...register('notes')} className="w-full px-3 py-2 border rounded-md" rows={3} />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
