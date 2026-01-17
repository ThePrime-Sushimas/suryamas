/**
 * POS Transactions Controller
 */

import { Response } from 'express'
import { AuthRequest } from '../../../types/common.types'
import { posTransactionsService } from './pos-transactions.service'
import { sendSuccess, sendError } from '../../../utils/response.util'
import { logInfo } from '../../../config/logger'
import * as XLSX from 'xlsx'

export const list = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.context?.company_id
    if (!companyId) {
      return sendError(res, 'Company ID required', 400)
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50

    const filters = {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      salesNumber: req.query.salesNumber as string,
      billNumber: req.query.billNumber as string,
      branches: req.query.branches as string, // comma-separated
      area: req.query.area as string,
      brand: req.query.brand as string,
      city: req.query.city as string,
      menuName: req.query.menuName as string,
      paymentMethods: req.query.paymentMethods as string, // comma-separated
      regularMemberName: req.query.regularMemberName as string,
      customerName: req.query.customerName as string,
      visitPurpose: req.query.visitPurpose as string,
      salesType: req.query.salesType as string,
      menuCategory: req.query.menuCategory as string,
      menuCategoryDetail: req.query.menuCategoryDetail as string,
      menuCode: req.query.menuCode as string,
      customMenuName: req.query.customMenuName as string,
      tableSection: req.query.tableSection as string,
      tableName: req.query.tableName as string
    }

    const result = await posTransactionsService.list(companyId, { page, limit }, filters)

    logInfo('PosTransactionsController list success', { 
      company_id: companyId, 
      count: result.data.length,
      total: result.total 
    })

    sendSuccess(res, result, 'Transactions retrieved successfully')
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to fetch transactions', 500)
  }
}

export const exportToExcel = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.context?.company_id
    if (!companyId) {
      return sendError(res, 'Company ID required', 400)
    }

    const filters = {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      salesNumber: req.query.salesNumber as string,
      billNumber: req.query.billNumber as string,
      branches: req.query.branches as string,
      area: req.query.area as string,
      brand: req.query.brand as string,
      city: req.query.city as string,
      menuName: req.query.menuName as string,
      paymentMethods: req.query.paymentMethods as string,
      regularMemberName: req.query.regularMemberName as string,
      customerName: req.query.customerName as string,
      visitPurpose: req.query.visitPurpose as string,
      salesType: req.query.salesType as string,
      menuCategory: req.query.menuCategory as string,
      menuCategoryDetail: req.query.menuCategoryDetail as string,
      menuCode: req.query.menuCode as string,
      customMenuName: req.query.customMenuName as string,
      tableSection: req.query.tableSection as string,
      tableName: req.query.tableName as string
    }

    const result = await posTransactionsService.exportToExcel(companyId, filters)

    // Create workbook
    const workbook = XLSX.utils.book_new()
    
    // Prepare data for Excel
    const excelData = result.data.map(tx => ({
      'Bill Number': tx.bill_number,
      'Sales Number': tx.sales_number,
      'Sales Date': tx.sales_date,
      'Branch': tx.branch,
      'Area': tx.area,
      'Brand': tx.brand,
      'City': tx.city,
      'Menu': tx.menu,
      'Menu Category': tx.menu_category,
      'Payment Method': tx.payment_method,
      'Sales Type': tx.sales_type,
      'Customer Name': tx.customer_name,
      'Qty': tx.qty,
      'Price': tx.price,
      'Subtotal': tx.subtotal,
      'Discount': tx.discount,
      'Tax': tx.tax,
      'Total': tx.total
    }))

    // Add summary row
    excelData.push({
      'Bill Number': '',
      'Sales Number': '',
      'Sales Date': '',
      'Branch': '',
      'Area': '',
      'Brand': '',
      'City': '',
      'Menu': '',
      'Menu Category': '',
      'Payment Method': '',
      'Sales Type': '',
      'Customer Name': 'TOTAL',
      'Qty': '' as any,
      'Price': '' as any,
      'Subtotal': result.summary.totalSubtotal,
      'Discount': result.summary.totalDiscount,
      'Tax': result.summary.totalTax,
      'Total': result.summary.totalAmount
    })

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Set headers
    const filename = `POS_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    logInfo('PosTransactionsController export success', { 
      company_id: companyId, 
      count: result.data.length 
    })

    res.send(buffer)
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to export transactions', 500)
  }
}
