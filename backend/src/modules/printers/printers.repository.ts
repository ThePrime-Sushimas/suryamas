import { pool } from '../../config/db'
import type { Printer, PrinterWithRelations, CreatePrinterDto, UpdatePrinterDto } from './printers.types'

export class PrintersRepository {
  async findAll(companyId: string): Promise<PrinterWithRelations[]> {
    const { rows } = await pool.query(
      `SELECT p.*, b.branch_name
       FROM printers p
       LEFT JOIN branches b ON b.id = p.branch_id
       WHERE p.company_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.is_default DESC, p.printer_name ASC`,
      [companyId]
    )
    return rows
  }

  async findById(id: string, companyId: string): Promise<PrinterWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT p.*, b.branch_name
       FROM printers p
       LEFT JOIN branches b ON b.id = p.branch_id
       WHERE p.id = $1 AND p.company_id = $2 AND p.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findDefault(companyId: string, branchId?: string): Promise<PrinterWithRelations | null> {
    const conditions = ['p.company_id = $1', 'p.deleted_at IS NULL', 'p.is_active = true', 'p.is_default = true']
    const params: unknown[] = [companyId]
    if (branchId) { params.push(branchId); conditions.push(`p.branch_id = $${params.length}`) }

    const { rows } = await pool.query(
      `SELECT p.*, b.branch_name FROM printers p LEFT JOIN branches b ON b.id = p.branch_id WHERE ${conditions.join(' AND ')} LIMIT 1`,
      params
    )
    return rows[0] ?? null
  }

  async create(companyId: string, dto: CreatePrinterDto): Promise<Printer> {
    const { rows } = await pool.query(
      `INSERT INTO printers (company_id, branch_id, printer_name, ip_address, port, paper_width, is_default, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
      [companyId, dto.branch_id ?? null, dto.printer_name, dto.ip_address, dto.port, dto.paper_width ?? 80, dto.is_default ?? false, dto.is_active ?? true, dto.created_by ?? null]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdatePrinterDto): Promise<Printer | null> {
    const fields: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (dto.branch_id !== undefined) { params.push(dto.branch_id); fields.push(`branch_id = $${idx++}`) }
    if (dto.printer_name !== undefined) { params.push(dto.printer_name); fields.push(`printer_name = $${idx++}`) }
    if (dto.ip_address !== undefined) { params.push(dto.ip_address); fields.push(`ip_address = $${idx++}`) }
    if (dto.port !== undefined) { params.push(dto.port); fields.push(`port = $${idx++}`) }
    if (dto.paper_width !== undefined) { params.push(dto.paper_width); fields.push(`paper_width = $${idx++}`) }
    if (dto.is_default !== undefined) { params.push(dto.is_default); fields.push(`is_default = $${idx++}`) }
    if (dto.is_active !== undefined) { params.push(dto.is_active); fields.push(`is_active = $${idx++}`) }
    if (dto.updated_by) { params.push(dto.updated_by); fields.push(`updated_by = $${idx++}`) }

    params.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE printers SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL RETURNING *`,
      params
    )
    return rows[0] ?? null
  }

  async clearDefault(companyId: string, branchId?: string | null, excludeId?: string): Promise<void> {
    const conditions = ['company_id = $1', 'deleted_at IS NULL', 'is_default = true']
    const params: unknown[] = [companyId]
    if (branchId) { params.push(branchId); conditions.push(`branch_id = $${params.length}`) }
    if (excludeId) { params.push(excludeId); conditions.push(`id != $${params.length}`) }
    await pool.query(`UPDATE printers SET is_default = false WHERE ${conditions.join(' AND ')}`, params)
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE printers SET deleted_at = now(), is_active = false, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }
}

export const printersRepository = new PrintersRepository()
