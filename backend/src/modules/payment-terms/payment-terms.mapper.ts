// backend/src/modules/payment-terms/payment-terms.mapper.ts

import { PaymentTerm } from './payment-terms.types'

export const mapPaymentTermFromDb = (raw: any): PaymentTerm => {
  if (!raw) return raw

  return {
    id: raw.id_payment_term,
    term_code: raw.term_code,
    term_name: raw.term_name,
    calculation_type: raw.calculation_type,
    days: raw.days,
    payment_dates: raw.payment_dates,
    payment_day_of_week: raw.payment_day_of_week,
    early_payment_discount: parseFloat(raw.early_payment_discount),
    early_payment_days: raw.early_payment_days,
    late_payment_penalty: parseFloat(raw.late_payment_penalty),
    grace_period_days: raw.grace_period_days,
    minimum_order_amount: parseFloat(raw.minimum_order_amount),
    maximum_order_amount: raw.maximum_order_amount ? parseFloat(raw.maximum_order_amount) : null,
    allowed_payment_methods: raw.allowed_payment_methods,
    requires_guarantee: raw.requires_guarantee === true || raw.requires_guarantee === 'true',
    guarantee_type: raw.guarantee_type,
    seasonal_terms: raw.seasonal_terms,
    volume_discount_tiers: raw.volume_discount_tiers,
    is_active: raw.is_active === true || raw.is_active === 'true',
    description: raw.description,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deleted_at: raw.deleted_at,
    created_by: raw.created_by,
    deleted_by: raw.deleted_by,
  }
}

export const mapPaymentTermsFromDb = (rawTerms: any[]): PaymentTerm[] => {
  return rawTerms.map(mapPaymentTermFromDb)
}
