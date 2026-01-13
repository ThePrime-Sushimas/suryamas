import { supabase } from '../config/supabase'
import { logError } from '../config/logger'

export class CompanyAccessService {
  private static cache = new Map<string, { hasAccess: boolean; expiresAt: number }>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if user has access to a specific company
   */
  static async validateUserCompanyAccess(userId: string, companyId: string): Promise<boolean> {
    const cacheKey = `${userId}:${companyId}`
    const cached = this.cache.get(cacheKey)
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.hasAccess
    }

    try {
      const { data, error } = await supabase
        .from('employee_branches')
        .select(`
          branches!inner(company_id),
          employees!inner(user_id)
        `)
        .eq('employees.user_id', userId)
        .eq('branches.company_id', companyId)
        .eq('status', 'active')
        .limit(1)

      if (error) {
        logError('Failed to validate company access', { 
          error: error.message, 
          userId, 
          companyId 
        })
        return false
      }

      const hasAccess = data && data.length > 0
      
      // Cache the result
      this.cache.set(cacheKey, {
        hasAccess,
        expiresAt: Date.now() + this.CACHE_TTL
      })

      return hasAccess
    } catch (error: any) {
      logError('Company access validation error', { 
        error: error.message, 
        userId, 
        companyId 
      })
      return false
    }
  }

  /**
   * Get all companies that user has access to
   */
  static async getUserCompanies(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('employee_branches')
        .select(`
          branches!inner(company_id),
          employees!inner(user_id)
        `)
        .eq('employees.user_id', userId)
        .eq('status', 'active')

      if (error) {
        logError('Failed to get user companies', { error: error.message, userId })
        return []
      }

      const companyIds = [...new Set(data?.map((item: any) => item.branches.company_id) || [])]
      return companyIds
    } catch (error: any) {
      logError('Get user companies error', { error: error.message, userId })
      return []
    }
  }

  /**
   * Invalidate cache for user
   */
  static invalidateUserCache(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    this.cache.clear()
  }
}