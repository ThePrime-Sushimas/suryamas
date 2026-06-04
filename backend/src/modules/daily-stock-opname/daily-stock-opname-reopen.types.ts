// ─── REOPEN TYPES ─────────────────────────────────────────────────────────────

export type ReopenRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface OpnameReopenRequest {
  id: string
  closing_id: string
  requested_by: string
  requested_at: string
  reason: string
  status: ReopenRequestStatus
  responded_by: string | null
  responded_at: string | null
  response_note: string | null
  created_at: string
  updated_at: string
}

export interface OpnameReopenRequestWithRelations extends OpnameReopenRequest {
  requested_by_name: string
  responded_by_name: string | null
  closing_date: string
  branch_name: string
}

export interface CreateReopenRequestDto {
  reason: string
}

export interface RespondReopenRequestDto {
  response_note?: string
}
