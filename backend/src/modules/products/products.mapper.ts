import { Product } from './products.types'

/**
 * Maps raw database product data to Product type with proper type conversions
 */
export const mapProductFromDb = (raw: any): Product => {
  if (!raw) return raw

  return {
    ...raw,
    is_requestable: raw.is_requestable === true || raw.is_requestable === 'true',
    is_purchasable: raw.is_purchasable === true || raw.is_purchasable === 'true',
    is_deleted: raw.is_deleted === true || raw.is_deleted === 'true',
  }
}

/**
 * Maps array of raw database products
 */
export const mapProductsFromDb = (rawProducts: any[]): Product[] => {
  return rawProducts.map(mapProductFromDb)
}

/**
 * Extracts category and subcategory names from joined data
 */
export const mapProductWithRelations = (raw: any): Product & { category_name?: string; sub_category_name?: string } => {
  const product = mapProductFromDb(raw)
  
  return {
    ...product,
    category_name: raw.categories?.category_name,
    sub_category_name: raw.sub_categories?.sub_category_name,
  }
}
