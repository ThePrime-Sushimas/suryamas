import { Request, Response, NextFunction } from 'express'

export interface FilterRequest extends Request {
  filterParams: {
    branch_name?: string
    is_active?: boolean
    status_employee?: string
    job_position?: string
  }
}

export const filterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const filter: any = {}

  if (req.query.branch_name) {
    filter.branch_name = req.query.branch_name as string
  }

  if (req.query.is_active !== undefined) {
    filter.is_active = req.query.is_active === 'true'
  }

  if (req.query.status_employee) {
    filter.status_employee = req.query.status_employee as string
  }

  if (req.query.job_position) {
    filter.job_position = req.query.job_position as string
  }

  (req as FilterRequest).filterParams = filter
  next()
}
