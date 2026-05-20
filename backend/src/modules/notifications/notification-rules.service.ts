import { notificationRulesRepository } from './notification-rules.repository'
import { NOTIFICATION_EVENT_CATALOG } from './notification-events'
import type { NotificationRuleCatalogItem, NotificationRuleUpsertDto } from './notification-rules.types'

export class NotificationRulesService {
  async getCatalog(companyId: string): Promise<NotificationRuleCatalogItem[]> {
    const rules = await notificationRulesRepository.findByCompany(companyId)
    const ruleByEvent = new Map(rules.map((r) => [r.event_key, r]))

    return NOTIFICATION_EVENT_CATALOG.map((def) => ({
      ...def,
      rule: ruleByEvent.get(def.event_key) ?? null,
    }))
  }

  async saveRules(companyId: string, rules: NotificationRuleUpsertDto[], userId: string): Promise<void> {
    await notificationRulesRepository.upsertMany(companyId, rules, userId)
  }
}

export const notificationRulesService = new NotificationRulesService()
