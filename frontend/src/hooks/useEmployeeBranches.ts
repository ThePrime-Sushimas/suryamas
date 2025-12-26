import { useState, useCallback, useEffect, useRef } from 'react'
import { employeeBranchService } from '@/services/employeeBranchService'
import type { EmployeeBranch, CreateEmployeeBranchDto, EmployeeBranchFilter } from '@/types/employeeBranch'
import type { PaginationMeta } from '@/types/pagination'

export const useEmployeeBranchesList = (
  page: number,
  limit: number,
  filter?: EmployeeBranchFilter | null
) => {
  const [data, setData] = useState<EmployeeBranch[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({ total: 0, page: 1, limit: 10 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetch = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const res = await employeeBranchService.list(page, limit, filter)
      setData(res.data.data)
      setPagination(res.data.pagination)
    } catch (err: any) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
        setError(err.response?.data?.error || 'Failed to fetch employee branches')
      }
    } finally {
      setLoading(false)
    }
  }, [page, limit, filter])

  useEffect(() => {
    fetch()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetch])

  return { data, pagination, loading, error, refetch: fetch }
}

export const useCreateEmployeeBranch = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(async (data: CreateEmployeeBranchDto) => {
    setLoading(true)
    setError(null)
    try {
      const res = await employeeBranchService.create(data)
      return res.data.data
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create assignment')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export const useDeleteEmployeeBranch = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const delete_ = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await employeeBranchService.delete(id)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete assignment')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { delete: delete_, loading, error }
}
