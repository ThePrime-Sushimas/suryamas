import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface NotificationRuleCatalogItem {
  event_key: string
  label: string
  description: string
  category: string
  default_type: string
  default_title_template: string
  default_message_template: string
  default_redirect_url_template: string
  rule: {
    id: string
    event_key: string
    position_id: string | null
    position_name?: string | null
    position_code?: string | null
    is_active: boolean
    title_template: string
    message_template: string
  } | null
}

export interface NotificationRuleDraft {
  event_key: string
  position_id: string | null
  is_active: boolean
}

export const useNotificationRulesCatalog = (companyId?: string, enabled = true) =>
  useQuery({
    queryKey: ['notification-rules', companyId ?? 'default'],
    queryFn: async () => {
      const params = companyId ? { company_id: companyId } : undefined
      const { data } = await api.get('/notifications/rules', { params })
      return (data.data || []) as NotificationRuleCatalogItem[]
    },
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

export const useSaveNotificationRules = (companyId?: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rules: NotificationRuleDraft[]) => {
      const params = companyId ? { company_id: companyId } : undefined
      const { data } = await api.put('/notifications/rules', { rules }, { params })
      return (data.data || []) as NotificationRuleCatalogItem[]
    },
    onSuccess: (catalog) => {
      qc.setQueryData(['notification-rules', companyId ?? 'default'], catalog)
    },
  })
}
