export type AggregateStatus = 
  | "PENDING" 
  | "READY" 
  | "FAILED" 
  | "RECALCULATED" 
  | "PENDING_MAPPING" 
  | "INVALID"
  | "VOID";

export interface PaymentMethodInfo {
  id: number;
  name: string;
  payment_type: string;
}

export interface PosSyncAggregate {
  id: string;
  sales_date: string;
  branch_pos_id: number;
  branch_id: string | null;
  branch_name: string | null;
  payment_pos_id: number;
  payment_method_id: number | null;
  payment_methods: PaymentMethodInfo | null;
  gross_amount: number;
  discount_amount: number;
  menu_discount_amount: number;
  promotion_discount_amount: number;
  voucher_discount_amount: number;
  tax_amount: number;
  other_tax_amount: number;
  other_vat_amount: number;
  grand_total: number;
  rounding_amount: number;
  delivery_cost: number;
  order_fee: number;
  voucher_payment_amount: number;
  payment_amount: number;
  transaction_count: number;
  void_transaction_count: number;
  pax_total: number;
  fee_percentage: number;
  fee_fixed_amount: number;
  percentage_fee_amount: number;
  fixed_fee_amount_calc: number;
  total_fee_amount: number;
  nett_amount: number;
  status: AggregateStatus;
  skip_reason: string | null;
  recalculated: boolean;
  recalculated_count: number;
  recalculated_at: string | null;
  is_reconciled: boolean;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface PosSyncAggregateLine {
  id: string;
  aggregate_id: string;
  sales_num: string;
  sales_date: string;
  branch_pos_id: number;
  subtotal: number;
  discount_total: number;
  menu_discount_total: number;
  promotion_discount: number;
  voucher_discount_total: number;
  other_tax_total: number;
  vat_total: number;
  other_vat_total: number;
  grand_total: number;
  rounding_total: number;
  delivery_cost: number;
  order_fee: number;
  voucher_total: number;
  payment_pos_id: number;
  payment_amount: number;
  created_at: string;
}

export interface ListAggregatesParams {
  date_from?: string;
  date_to?: string;
  branch_id?: string;
  branch_ids?: string | string[];
  payment_method_id?: string;
  payment_method_ids?: string | string[];
  status?: string;
  is_reconciled?: boolean | string;
  search?: string;
  page?: number;
  limit?: number;
}
