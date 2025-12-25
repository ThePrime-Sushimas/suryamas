import { Request, Response, NextFunction } from 'express'

export interface SortRequest extends Request {
  sort: {
    field: string
    order: 'asc' | 'desc'
  }
}

const ALLOWED_SORT_FIELDS = [
  'employee_id', 'full_name', 'job_position', 'branch_name',
  'email', 'mobile_phone', 'nik', 'birth_date', 'birth_place', 'age',
  'gender', 'religion', 'marital_status', 'join_date', 'resign_date',
  'sign_date', 'end_date', 'status_employee', 'ptkp_status',
  'bank_name', 'bank_account', 'bank_account_holder', 'is_active',
  'branch_code', 'city', 'status', 'hari_operasional', 'created_at'
]

export const sortMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const sortField = (req.query.sort as string) || 'full_name'
  const sortOrder = (req.query.order as string) || 'asc'

  if (!ALLOWED_SORT_FIELDS.includes(sortField)) {
    return res.status(400).json({
      success: false,
      error: `Invalid sort field. Allowed: ${ALLOWED_SORT_FIELDS.join(', ')}`
    })
  }

  if (!['asc', 'desc'].includes(sortOrder.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: 'Invalid sort order. Use "asc" or "desc"'
    })
  }

  (req as SortRequest).sort = {
    field: sortField,
    order: sortOrder.toLowerCase() as 'asc' | 'desc'
  }

  next()
}
