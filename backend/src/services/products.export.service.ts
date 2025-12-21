import * as ExcelJS from 'exceljs'
import { productsRepository } from '../modules/products/products.repository'
import { productUomsRepository } from '../modules/product-uoms/product-uoms.repository'

export class ProductsExportService {
  async export(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Products')

    const headers = [
      'product_code',
      'product_name',
      'bom_name',
      'category_id',
      'sub_category_id',
      'is_requestable',
      'is_purchasable',
      'notes',
      'status',
      'unit_name',
      'conversion_factor',
      'is_base_unit',
      'base_price',
      'is_default_stock_unit',
      'is_default_purchase_unit',
      'is_default_base_unit',
      'is_default_transfer_unit',
    ]

    worksheet.addRow(headers)
    worksheet.getRow(1).font = { bold: true }

    const { data: products } = await productsRepository.findAll({ limit: 10000, offset: 0 })

    for (const product of products) {
      const uoms = await productUomsRepository.findByProductId(product.id)

      if (uoms.length === 0) {
        worksheet.addRow([
          product.product_code,
          product.product_name,
          product.bom_name || '',
          product.category_id,
          product.sub_category_id,
          product.is_requestable ? 'TRUE' : 'FALSE',
          product.is_purchasable ? 'TRUE' : 'FALSE',
          product.notes || '',
          product.status,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ])
      } else {
        for (const uom of uoms) {
          worksheet.addRow([
            product.product_code,
            product.product_name,
            product.bom_name || '',
            product.category_id,
            product.sub_category_id,
            product.is_requestable ? 'TRUE' : 'FALSE',
            product.is_purchasable ? 'TRUE' : 'FALSE',
            product.notes || '',
            product.status,
            uom.unit_name,
            uom.conversion_factor,
            uom.is_base_unit ? 'TRUE' : 'FALSE',
            uom.base_price || '',
            uom.is_default_stock_unit ? 'TRUE' : 'FALSE',
            uom.is_default_purchase_unit ? 'TRUE' : 'FALSE',
            uom.is_default_base_unit ? 'TRUE' : 'FALSE',
            uom.is_default_transfer_unit ? 'TRUE' : 'FALSE',
          ])
        }
      }
    }

    worksheet.columns.forEach(column => {
      column.width = 15
    })

    const arrayBuffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(arrayBuffer)
  }
}

export const productsExportService = new ProductsExportService()
