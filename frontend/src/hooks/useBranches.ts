import { useState, useCallback } from 'react'
import { branchService } from '@/services/branchService'
import type { Branch, CreateBranchDto, UpdateBranchDto } from '@/types/branch'

type Paginated<T> = {
  success: boolean
  data: T[]
  pagination: { total: number; page: number; limit: number }
}

export const useBranchesList = (page: number, limit: number, sort?: any, filter?: any) => {
  const [data, setData] = useState<Branch[]>([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await branchService.list(page, limit, sort, filter)
      setData(res.data.data)
      setPagination(res.data.pagination)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch branches')
    } finally {
      setLoading(false)
    }
  }, [page, limit, sort, filter])

  return { data, pagination, loading, error, fetch }
}

export const useBranchById = (id: string) => {
  const [data, setData] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await branchService.getById(id)
      setData(res.data.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch branch')
    } finally {
      setLoading(false)
    }
  }, [id])

  return { data, loading, error, fetch }
}

export const useCreateBranch = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Record<string, string> | null>(null)

  const create = useCallback(async (data: CreateBranchDto) => {
    setLoading(true)
    setError(null)
    try {
      const res = await branchService.create(data)
      return res.data.data
    } catch (err: any) {
      const fieldErrors = err.response?.data?.errors
      setError(fieldErrors || { submit: err.response?.data?.error || 'Failed to create branch' })
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export const useUpdateBranch = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Record<string, string> | null>(null)

  const update = useCallback(async (id: string, data: UpdateBranchDto) => {
    setLoading(true)
    setError(null)
    try {
      const res = await branchService.update(id, data)
      return res.data.data
    } catch (err: any) {
      const fieldErrors = err.response?.data?.errors
      setError(fieldErrors || { submit: err.response?.data?.error || 'Failed to update branch' })
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

export const useDeleteBranch = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const delete_ = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await branchService.delete(id)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete branch')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { delete: delete_, loading, error }
}

export const useBulkUpdateStatus = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateStatus = useCallback(async (ids: string[], status: string) => {
    setLoading(true)
    setError(null)
    try {
      await branchService.bulkUpdateStatus(ids, status)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { updateStatus, loading, error }
}
