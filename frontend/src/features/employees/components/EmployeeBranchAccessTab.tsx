import { useEffect, useState } from 'react'
import { Building2, Shield, DollarSign } from 'lucide-react'
import api from '@/lib/axios'
import { CardSkeleton } from '@/components/ui/Skeleton'

interface BranchAssignment {
  id: string
  branch_id: string
  branch_name: string
  branch_code: string
  role_id: string
  role_name: string
  approval_limit: number
  is_primary: boolean
  status: string
}

interface Props {
  employeeId: string
}

export function EmployeeBranchAccessTab({ employeeId }: Props) {
  const [branches, setBranches] = useState<BranchAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await api.get<{ success: boolean; data: BranchAssignment[] }>(`/employee-branches/employee/${employeeId}`)
        setBranches(data.data || [])
      } catch {
        setBranches([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchBranches()
  }, [employeeId])

  if (isLoading) {
    return <div className="flex justify-center py-8"><CardSkeleton /></div>
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-8">
        <Building2 className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">No branch access assigned</p>
      </div>
    )
  }

  const sortedBranches = [...branches].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return a.branch_name.localeCompare(b.branch_name)
  })

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Branch</th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Approval Limit</th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {sortedBranches.map((branch) => (
            <tr key={branch.id} className={branch.is_primary ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
              <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white">{branch.branch_name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({branch.branch_code})</span>
                  </div>
                  {branch.is_primary && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 shrink-0">
                      Primary
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-gray-900 dark:text-white">{branch.role_name}</span>
                </div>
              </td>
              <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-gray-900 dark:text-white">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(branch.approval_limit)}
                  </span>
                </div>
              </td>
              <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  branch.status === 'active' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                }`}>
                  {branch.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
