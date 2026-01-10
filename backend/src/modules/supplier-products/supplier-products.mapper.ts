import { SupplierProduct, SupplierProductWithRelations } from './supplier-products.types'

/**
 * Maps raw database supplier product data to SupplierProduct type with proper type conversions
 */
export const mapSupplierProductFromDb = (raw: any): SupplierProduct => {
  if (!raw) return raw

  return {
    ...raw,
    price: raw.price ? parseFloat(raw.price) : 0,
    lead_time_days: raw.lead_time_days ? parseInt(raw.lead_time_days) : null,
    min_order_qty: raw.min_order_qty ? parseFloat(raw.min_order_qty) : null,
    is_preferred: raw.is_preferred === true || raw.is_preferred === 'true',
    is_active: raw.is_active === true || raw.is_active === 'true',
  }
}

/**
 * Maps array of raw database supplier products
 */
export const mapSupplierProductsFromDb = (rawSupplierProducts: any[]): SupplierProduct[] => {
  return rawSupplierProducts.map(mapSupplierProductFromDb)
}

/**
 * Maps supplier product with joined supplier and product data
 */
export const mapSupplierProductWithRelations = (raw: unknown): SupplierProductWithRelations => {
  const supplierProduct = mapSupplierProductFromDb(raw)
  const item = raw as Record<string, unknown>
  
  return {
    ...supplierProduct,
    supplier: item.suppliers ? {
      id: (item.suppliers as Record<string, unknown>).id as string,
      supplier_name: (item.suppliers as Record<string, unknown>).supplier_name as string,
      supplier_code: (item.suppliers as Record<string, unknown>).supplier_code as string,
      is_active: (item.suppliers as Record<string, unknown>).is_active === true,
    } : undefined,
    product: item.products ? {
      id: (item.products as Record<string, unknown>).id as string,
      product_name: (item.products as Record<string, unknown>).product_name as string,
      product_code: (item.products as Record<string, unknown>).product_code as string,
      product_type: (item.products as Record<string, unknown>).product_type as string,
      status: (item.products as Record<string, unknown>).status as string,
      default_purchase_unit: (item.products as Record<string, unknown>).default_purchase_unit as string,
    } : undefined,
  }
}

/**
 * Maps supplier product for option/dropdown usage
 */
export const mapSupplierProductOption = (raw: any) => ({
  id: raw.id,
  supplier_name: raw.suppliers?.supplier_name || 'Unknown Supplier',
  product_name: raw.products?.product_name || 'Unknown Product',
  price: parseFloat(raw.price) || 0,
  currency: raw.currency || 'IDR',
})