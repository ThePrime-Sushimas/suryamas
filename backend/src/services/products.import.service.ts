import * as XLSX from 'xlsx'
import { Product, ProductUom, CreateProductDto, CreateProductUomDto } from '../modules/products/products.types'
import { productsRepository } from '../modules/products/products.repository'
import { productUomsRepository } from '../modules/product-uoms/product-uoms.repository'
import { metricUnitsRepository } from '../modules/metric-units/metricUnits.repository'

interface ImportRow {
  product_code: string
  product_name: string
  bom_name?: string
  category_id: string
  sub_category_id: string
  is_requestable?: boolean
  is_purchasable?: boolean
  notes?: string
  status?: string
  metric_unit_name: string
  conversion_factor: number
  is_base_unit?: boolean
  base_price?: number
  is_default_stock_unit?: boolean
  is_default_purchase_unit?: boolean
  is_default_transfer_unit?: boolean
}

interface ImportPreview {
  totalRows: number
  newProducts: number
  existingProducts: number
  errors: { row: number; message: string }[]
}

interface ImportResult {
  success: number
  failed: number
  errors: { row: number; message: string }[]
}

export class ProductsImportService {
  async parseExcel(buffer: Buffer): Promise<ImportRow[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet) as any[]

    return rows.map(row => ({
      product_code: row.product_code?.toString().trim(),
      product_name: row.product_name?.toString().trim(),
      bom_name: row.bom_name?.toString().trim() || undefined,
      category_id: row.category_id?.toString().trim(),
      sub_category_id: row.sub_category_id?.toString().trim(),
      is_requestable: row.is_requestable === 'TRUE' || row.is_requestable === true,
      is_purchasable: row.is_purchasable === 'TRUE' || row.is_purchasable === true,
      notes: row.notes?.toString().trim() || undefined,
      status: row.status?.toString().trim() || 'ACTIVE',
      metric_unit_name: row.metric_unit_name?.toString().trim() || row.unit_name?.toString().trim(),
      conversion_factor: parseFloat(row.conversion_factor),
      is_base_unit: row.is_base_unit === 'TRUE' || row.is_base_unit === true,
      base_price: row.base_price ? parseFloat(row.base_price) : undefined,
      is_default_stock_unit: row.is_default_stock_unit === 'TRUE' || row.is_default_stock_unit === true,
      is_default_purchase_unit: row.is_default_purchase_unit === 'TRUE' || row.is_default_purchase_unit === true,
      is_default_transfer_unit: row.is_default_transfer_unit === 'TRUE' || row.is_default_transfer_unit === true,
    }))
  }

  async validateRow(row: ImportRow, rowIndex: number): Promise<string | null> {
    if (!row.product_code) return `Row ${rowIndex}: product_code is required`
    if (!row.product_name) return `Row ${rowIndex}: product_name is required`
    if (!row.category_id) return `Row ${rowIndex}: category_id is required`
    if (!row.sub_category_id) return `Row ${rowIndex}: sub_category_id is required`
    if (!row.metric_unit_name) return `Row ${rowIndex}: metric_unit_name is required`
    if (isNaN(row.conversion_factor) || row.conversion_factor <= 0) {
      return `Row ${rowIndex}: conversion_factor must be a positive number`
    }
    return null
  }

  async preview(buffer: Buffer): Promise<ImportPreview> {
    const rows = await this.parseExcel(buffer)
    const errors: { row: number; message: string }[] = []
    const productCodes = new Set<string>()
    let newProducts = 0
    let existingProducts = 0

    for (let i = 0; i < rows.length; i++) {
      const error = await this.validateRow(rows[i], i + 2)
      if (error) {
        errors.push({ row: i + 2, message: error })
        continue
      }

      const existing = await productsRepository.findByProductCode(rows[i].product_code)
      if (existing) {
        if (!productCodes.has(rows[i].product_code)) {
          existingProducts++
          productCodes.add(rows[i].product_code)
        }
      } else {
        if (!productCodes.has(rows[i].product_code)) {
          newProducts++
          productCodes.add(rows[i].product_code)
        }
      }
    }

    return {
      totalRows: rows.length,
      newProducts,
      existingProducts,
      errors,
    }
  }

  async import(buffer: Buffer, userId?: string): Promise<ImportResult> {
    const rows = await this.parseExcel(buffer)
    const errors: { row: number; message: string }[] = []
    let success = 0
    let failed = 0
    const processedProducts = new Map<string, string>()
    const metricUnitCache = new Map<string, string>()

    // Pre-load all active metric units
    const { data: metricUnits } = await metricUnitsRepository.listActiveFromView({ page: 1, limit: 1000, offset: 0 })
    metricUnits.forEach(mu => metricUnitCache.set(mu.unit_name.toLowerCase(), mu.id))

    for (let i = 0; i < rows.length; i++) {
      try {
        const error = await this.validateRow(rows[i], i + 2)
        if (error) {
          errors.push({ row: i + 2, message: error })
          failed++
          continue
        }

        // Find metric unit ID by name
        let metricUnitId = metricUnitCache.get(rows[i].metric_unit_name.toLowerCase())
        if (!metricUnitId) {
          // Try to find in database
          const metricUnit = metricUnits.find(mu => mu.unit_name.toLowerCase() === rows[i].metric_unit_name.toLowerCase())
          if (metricUnit) {
            metricUnitId = metricUnit.id
            metricUnitCache.set(rows[i].metric_unit_name.toLowerCase(), metricUnitId)
          } else {
            errors.push({ row: i + 2, message: `Row ${i + 2}: Metric unit "${rows[i].metric_unit_name}" not found` })
            failed++
            continue
          }
        }

        let productId: string
        const existing = await productsRepository.findByProductCode(rows[i].product_code)

        if (existing) {
          productId = existing.id
        } else {
          if (!processedProducts.has(rows[i].product_code)) {
            const productDto: CreateProductDto = {
              product_code: rows[i].product_code,
              product_name: rows[i].product_name,
              bom_name: rows[i].bom_name,
              category_id: rows[i].category_id,
              sub_category_id: rows[i].sub_category_id,
              is_requestable: rows[i].is_requestable,
              is_purchasable: rows[i].is_purchasable,
              notes: rows[i].notes,
              status: rows[i].status as any,
            }
            const product = await productsRepository.create({ ...productDto, created_by: userId, updated_by: userId })
            productId = product.id
            processedProducts.set(rows[i].product_code, productId)
          } else {
            productId = processedProducts.get(rows[i].product_code)!
          }
        }

        const uomDto: CreateProductUomDto = {
          metric_unit_id: metricUnitId,
          conversion_factor: rows[i].conversion_factor,
          is_base_unit: rows[i].is_base_unit,
          base_price: rows[i].base_price,
          is_default_stock_unit: rows[i].is_default_stock_unit,
          is_default_purchase_unit: rows[i].is_default_purchase_unit,
          is_default_transfer_unit: rows[i].is_default_transfer_unit,
        }

        await productUomsRepository.create({
          ...uomDto,
          product_id: productId,
          created_by: userId,
          updated_by: userId,
        })
        success++
      } catch (err: any) {
        errors.push({ row: i + 2, message: err.message })
        failed++
      }
    }

    return { success, failed, errors }
  }
}

export const productsImportService = new ProductsImportService()

