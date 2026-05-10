import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

// ─── Types ───

export interface Department {
  id: string
  department_code: string
  department_name: string
  sort_order: number
  is_active: boolean
  position_count: number
}

export interface Position {
  id: string
  department_id: string
  position_code: string
  position_name: string
  can_access_all_wip: boolean
  sort_order: number
  is_active: boolean
  department_code: string
  department_name: string
  employee_count: number
}

export interface EmployeePositionItem {
  id: string
  position_id: string
  position_code: string
  position_name: string
  department_code: string
  department_name: string
  is_primary: boolean
  can_access_all_wip: boolean
}

// ─── Departments ───

export const useDepartments = () =>
  useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get('/departments')
      return (data.data || []) as Department[]
    },
  })

export const useCreateDepartment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { department_code: string; department_name: string; sort_order?: number }) => {
      const { data } = await api.post('/departments', body)
      return data.data as Department
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }) },
  })
}

export const useUpdateDepartment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; department_name?: string; sort_order?: number; is_active?: boolean }) => {
      const { data } = await api.put(`/departments/${id}`, body)
      return data.data as Department
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }) },
  })
}

export const useDeleteDepartment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/departments/${id}`) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }) },
  })
}

// ─── Positions ───

export const usePositions = (departmentId?: string) =>
  useQuery({
    queryKey: ['positions', departmentId],
    queryFn: async () => {
      const params = departmentId ? { department_id: departmentId } : {}
      const { data } = await api.get('/positions', { params })
      return (data.data || []) as Position[]
    },
  })

export const useCreatePosition = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { department_id: string; position_code: string; position_name: string; can_access_all_wip?: boolean; sort_order?: number }) => {
      const { data } = await api.post('/positions', body)
      return data.data as Position
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }) },
  })
}

export const useUpdatePosition = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; department_id?: string; position_name?: string; can_access_all_wip?: boolean; sort_order?: number; is_active?: boolean }) => {
      const { data } = await api.put(`/positions/${id}`, body)
      return data.data as Position
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }) },
  })
}

export const useDeletePosition = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/positions/${id}`) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }) },
  })
}

// ─── Employee Positions ───

export const useEmployeePositions = (employeeId: string) =>
  useQuery({
    queryKey: ['employee-positions', employeeId],
    queryFn: async () => {
      const { data } = await api.get(`/employees/${employeeId}/positions`)
      return (data.data || []) as EmployeePositionItem[]
    },
    enabled: !!employeeId,
  })

export const useAssignPosition = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, position_id, is_primary }: { employeeId: string; position_id: string; is_primary?: boolean }) => {
      await api.post(`/employees/${employeeId}/positions`, { position_id, is_primary })
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['employee-positions', vars.employeeId] }) },
  })
}

export const useRemovePosition = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, positionId }: { employeeId: string; positionId: string }) => {
      await api.delete(`/employees/${employeeId}/positions/${positionId}`)
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['employee-positions', vars.employeeId] }) },
  })
}

export const useSetPrimaryPosition = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, positionId }: { employeeId: string; positionId: string }) => {
      await api.put(`/employees/${employeeId}/positions/${positionId}/primary`)
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['employee-positions', vars.employeeId] }) },
  })
}
