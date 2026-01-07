import { SupplierProduct, SupplierProductWithRelations } from './supplier-products.types'

/**
 * Maps raw database supplier product data to SupplierProduct type with proper type conversions
 */
export const mapSupplierProductFromDb = (raw: any): SupplierProduct => {
  if (!raw) return raw

  return {
    ...raw,
    price: parseFloat(raw.price) || 0,
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
export const mapSupplierProductWithRelations = (raw: any): SupplierProductWithRelations => {
  const supplierProduct = mapSupplierProductFromDb(raw)
  
  return {
    ...supplierProduct,
    supplier: raw.suppliers ? {
      id: raw.suppliers.id,
      supplier_name: raw.suppliers.supplier_name,
      supplier_code: raw.suppliers.supplier_code,
      is_active: raw.suppliers.is_active === true || raw.suppliers.is_active === 'true',
    } : undefined,
    product: raw.products ? {
      id: raw.products.id,
      product_name: raw.products.product_name,
      product_code: raw.products.product_code,
      product_type: raw.products.product_type,
      status: raw.products.status,
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