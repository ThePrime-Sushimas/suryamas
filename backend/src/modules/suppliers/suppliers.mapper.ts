import type { Supplier, SupplierOption } from './suppliers.types'

export const mapSupplierResponse = (row: Record<string, unknown>): Supplier => {
  return {
    id: row.id as string,
    supplier_code: row.supplier_code as string,
    supplier_name: row.supplier_name as string,
    supplier_type: row.supplier_type as Supplier['supplier_type'],
    contact_person: row.contact_person as string,
    phone: row.phone as string,
    email: row.email as string | null,
    address: row.address as string,
    city: row.city as string,
    province: row.province as string,
    postal_code: row.postal_code as string | null,
    tax_id: row.tax_id as string | null,
    business_license: row.business_license as string | null,
    payment_term_id: row.payment_term_id as number | null,
    lead_time_days: row.lead_time_days as number,
    minimum_order: row.minimum_order as number,
    rating: row.rating as number | null,
    is_active: row.is_active as boolean,
    notes: row.notes as string | null,
    created_by: row.created_by as string | null,
    updated_by: row.updated_by as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: row.deleted_at as string | null,
  }
}

export const mapSupplierOption = (row: Record<string, unknown>): SupplierOption => {
  return {
    id: row.id as string,
    supplier_name: row.supplier_name as string,
  }
}