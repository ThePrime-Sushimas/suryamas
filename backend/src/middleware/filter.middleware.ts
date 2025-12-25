import { Request, Response, NextFunction } from 'express'

export interface FilterRequest extends Request {
  filterParams?: Record<string, any>
}

export const filterMiddleware = (req: any, res: Response, next: NextFunction) => {
  try {
    const filter: Record<string, any> = {}
    const excludedParams = ['page', 'limit', 'sort', 'order', 'q', '_']
    
    Object.keys(req.query).forEach(key => {
      if (!excludedParams.includes(key) && req.query[key] !== undefined && req.query[key] !== '') {
        const value = req.query[key]
        
        // Handle bracket notation like filter[status], filter[city]
        if (key.includes('[') && key.includes(']')) {
          const cleanKey = key.match(/\[(.*?)\]/)?.[1]
          if (cleanKey) {
            // Handle different data types
            if (value === 'true' || value === 'false') {
              filter[cleanKey] = value === 'true'
            } else if (!isNaN(Number(value))) {
              filter[cleanKey] = Number(value)
            } else {
              filter[cleanKey] = value
            }
          }
        } else {
          // Handle direct filter parameters like status=active
          // Handle different data types
          if (value === 'true' || value === 'false') {
            filter[key] = value === 'true'
          } else if (!isNaN(Number(value))) {
            filter[key] = Number(value)
          } else {
            filter[key] = value
          }
        }
      }
    })
    
    req.filterParams = Object.keys(filter).length > 0 ? filter : undefined
    next()
  } catch (error) {
    next(error)
  }
}
