import { Supplier, SupplierOption } from './suppliers.types'

export const mapSupplierResponse = (row: any): Supplier => {
  return {
    id: row.id,
    supplier_code: row.supplier_code,
    supplier_name: row.supplier_name,
    supplier_type: row.supplier_type,
    contact_person: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    province: row.province,
    postal_code: row.postal_code,
    tax_id: row.tax_id,
    business_license: row.business_license,
    payment_term_id: row.payment_term_id,
    lead_time_days: row.lead_time_days,
    minimum_order: row.minimum_order,
    rating: row.rating,
    is_active: row.is_active,
    notes: row.notes,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

export const mapSupplierOption = (row: any): SupplierOption => {
  return {
    id: row.id,
    supplier_name: row.supplier_name,
  }
}