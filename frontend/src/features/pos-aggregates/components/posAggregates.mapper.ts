import type {
  CreateAggregatedTransactionDto,
  UpdateAggregatedTransactionDto,
} from "../types"
import type { PosAggregatesFormData } from "./posAggregatesForm.schema"

// ==========================================================
// Helpers (removed redundant normalizePaymentMethodId - does nothing useful)
// ==========================================================

// ==========================================================
// Mappers
// ==========================================================

export function mapFormToCreateDto(
  form: PosAggregatesFormData
): CreateAggregatedTransactionDto {
  return {
    branch_id: form.branch_id,
    source_type: form.source_type,
    source_id: form.source_id,
    source_ref: form.source_ref,
    transaction_date: form.transaction_date,

    payment_method_id: form.payment_method_id ?? null,

    gross_amount: form.gross_amount,
    discount_amount: form.discount_amount,
    tax_amount: form.tax_amount,
    service_charge_amount: form.service_charge_amount,
    bill_after_discount: form.bill_after_discount,
    percentage_fee_amount: form.percentage_fee_amount,
    fixed_fee_amount: form.fixed_fee_amount,
    total_fee_amount: form.total_fee_amount,
    nett_amount: form.nett_amount,

    currency: form.currency,
    status: form.status,
  }
}

export function mapFormToUpdateDto(
  form: PosAggregatesFormData
): UpdateAggregatedTransactionDto {
  return {
    branch_id: form.branch_id ?? undefined,
    source_id: form.source_id,
    source_ref: form.source_ref,
    transaction_date: form.transaction_date,

    payment_method_id: form.payment_method_id,

    gross_amount: form.gross_amount,
    discount_amount: form.discount_amount,
    tax_amount: form.tax_amount,
    service_charge_amount: form.service_charge_amount,
    bill_after_discount: form.bill_after_discount,
    percentage_fee_amount: form.percentage_fee_amount,
    fixed_fee_amount: form.fixed_fee_amount,
    total_fee_amount: form.total_fee_amount,
    nett_amount: form.nett_amount,

    currency: form.currency,
    status: form.status,
  }
}

