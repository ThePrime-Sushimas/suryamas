export interface NotificationRow {
  id: string
  company_id: string
  recipient_id: string
  event_key: string | null
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'approval_required'
  category: 'system' | 'purchase_request' | 'purchase_order' | 'purchase_invoice' | 'inventory' | 'accounting' | 'hrd'
  is_read: boolean
  read_at: Date | null
  data: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

export interface CreateNotificationInput {
  companyId: string
  recipientId: string
  title: string
  message: string
  eventKey?: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'approval_required'
  category?: 'system' | 'purchase_request' | 'purchase_order' | 'purchase_invoice' | 'inventory' | 'accounting' | 'hrd'
  data?: Record<string, unknown>
}

/** Payload emitted via Socket.IO — mirrors persisted notification fields */
export interface RealtimeNotificationPayload {
  id: string
  recipient_id: string
  title: string
  message: string
  type: NotificationRow['type']
  category: NotificationRow['category']
  is_read: boolean
  read_at: string | null
  data: Record<string, unknown>
  created_at: string
}
