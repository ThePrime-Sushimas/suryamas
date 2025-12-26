import { useState, useEffect } from 'react'
import { branchesApi } from '@/features/branches'
import type { Branch, BranchSort, BranchFilter } from '@/features/branches'

export const useBranchesList = (
  page: number,
  limit: number,
  sort?: BranchSort | null,
  filter?: BranchFilter | null
) => {
  const [data, setData] = useState<Branch[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    try {
      const res = await branchesApi.list(page, limit, sort, filter)
      setData(res.data)
      setPagination(res.pagination)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [page, limit, JSON.stringify(sort), JSON.stringify(filter)])

  return { data, pagination, loading, error, refetch }
}
