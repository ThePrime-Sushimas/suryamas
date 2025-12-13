import { supabase } from '../config/supabase'

export class AuditService {
  static async log(
    action: string,
    entityType: string,
    entityId: string,
    changedBy: string | null,
    oldValue?: any,
    newValue?: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const { error } = await supabase
        .from('perm_audit_log')
        .insert({
          action,
          entity_type: entityType,
          entity_id: entityId,
          changed_by: changedBy,
          old_value: oldValue ? JSON.stringify(oldValue) : null,
          new_value: newValue ? JSON.stringify(newValue) : null,
          ip_address: ipAddress,
          user_agent: userAgent
        })

      if (error) {
        console.error('Audit log error:', error)
      }
    } catch (err) {
      console.error('Failed to create audit log:', err)
    }
  }
}
