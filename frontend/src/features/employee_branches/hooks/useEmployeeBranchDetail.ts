import { useState, useCallback } from 'react'
import { employeeBranchesApi } from '../api/employeeBranches.api'
import type { EmployeeBranch } from '../api/types'

export const useEmployeeBranchDetail = (employeeId: string) => {
  const [branches, setBranches] = useState<EmployeeBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await employeeBranchesApi.getByEmployeeId(employeeId)
      setBranches(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  const refetch = useCallback(() => {
    return fetchBranches()
  }, [fetchBranches])

  return { branches, loading, error, fetchBranches, refetch }
}
