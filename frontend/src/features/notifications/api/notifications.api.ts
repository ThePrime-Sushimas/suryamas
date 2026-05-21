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

export const useNotificationRulesCatalog = () =>
  useQuery({
    queryKey: ['notification-rules'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/rules')
      return (data.data || []) as NotificationRuleCatalogItem[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

export const useSaveNotificationRules = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rules: NotificationRuleDraft[]) => {
      const { data } = await api.put('/notifications/rules', { rules })
      return (data.data || []) as NotificationRuleCatalogItem[]
    },
    onSuccess: (catalog) => {
      qc.setQueryData(['notification-rules'], catalog)
    },
  })
}
