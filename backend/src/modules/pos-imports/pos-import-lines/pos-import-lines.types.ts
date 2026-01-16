/**
 * POS Import Lines Types
 * Following journal-lines.types.ts pattern
 */

export interface PosImportLine {
  id: string
  pos_import_id: string
  row_number: number
  sales_number?: string
  bill_number?: string
  sales_type?: string
  batch_order?: string
  table_section?: string
  table_name?: string
  sales_date?: string
  sales_date_in?: string
  sales_date_out?: string
  branch?: string
  brand?: string
  city?: string
  area?: string
  visit_purpose?: string
  regular_member_code?: string
  regular_member_name?: string
  loyalty_member_code?: string
  loyalty_member_name?: string
  loyalty_member_type?: string
  employee_code?: string
  employee_name?: string
  external_employee_code?: string
  external_employee_name?: string
  customer_name?: string
  payment_method?: string
  menu_category?: string
  menu_category_detail?: string
  menu?: string
  custom_menu_name?: string
  menu_code?: string
  menu_notes?: string
  order_mode?: string
  qty?: number
  price?: number
  subtotal?: number
  discount?: number
  service_charge?: number
  tax?: number
  vat?: number
  total?: number
  nett_sales?: number
  dpp?: number
  bill_discount?: number
  total_after_bill_discount?: number
  waiter?: string
  order_time?: string
  journal_id?: string
  mapped_at?: string
  created_at: string
}

export interface CreatePosImportLineDto {
  pos_import_id: string
  row_number: number
  [key: string]: any // Allow all Excel columns
}
