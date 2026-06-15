import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  DepartmentEmployeePreview,
  ShortageQueryContext,
  ShortageRecord,
  ShortageRowForResolve,
} from './shortage-report.types'

function buildDailyFilters(ctx: ShortageQueryContext, params: unknown[], idx: { n: number }): string {
  const parts: string[] = []
  if (ctx.branchId) {
    params.push(ctx.branchId)
    parts.push(`dcc.branch_id = $${idx.n++}`)
  }
  if (ctx.positionId) {
    params.push(ctx.positionId)
    parts.push(`dcc.position_id = $${idx.n++}`)
  }
  if (ctx.itemId) {
    params.push(ctx.itemId)
    parts.push(`dccl.product_id = $${idx.n++}`)
  }
  if (ctx.categoryId) {
    params.push(ctx.categoryId)
    parts.push(`p.category_id = $${idx.n++}`)
  }
  if (ctx.resolveStatus) {
    params.push(ctx.resolveStatus)
    parts.push(`COALESCE(vcl.resolve_status, 'UNRESOLVED') = $${idx.n++}`)
  }
  if (ctx.vclId) {
    params.push(ctx.vclId)
    parts.push(`vcl.id = $${idx.n++}`)
  }
  return parts.length ? `AND ${parts.join(' AND ')}` : ''
}

function buildMonthlyFilters(ctx: ShortageQueryContext, params: unknown[], idx: { n: number }): string {
  const parts: string[] = []
  if (ctx.branchId) {
    params.push(ctx.branchId)
    parts.push(`mso.branch_id = $${idx.n++}`)
  }
  if (ctx.positionId) {
    params.push(ctx.positionId)
    parts.push(`mso.position_id = $${idx.n++}`)
  }
  if (ctx.itemId) {
    params.push(ctx.itemId)
    parts.push(`msol.product_id = $${idx.n++}`)
  }
  if (ctx.categoryId) {
    params.push(ctx.categoryId)
    parts.push(`p.category_id = $${idx.n++}`)
  }
  if (ctx.resolveStatus) {
    params.push(ctx.resolveStatus)
    parts.push(`COALESCE(vcl.resolve_status, 'UNRESOLVED') = $${idx.n++}`)
  }
  if (ctx.vclId) {
    params.push(ctx.vclId)
    parts.push(`vcl.id = $${idx.n++}`)
  }
  return parts.length ? `AND ${parts.join(' AND ')}` : ''
}

export class ShortageReportRepository {
  async getShortageRows(ctx: ShortageQueryContext): Promise<ShortageRecord[]> {
    const dailyParams: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    const monthlyParams: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    const dailyIdx = { n: 4 }
    const monthlyIdx = { n: 4 }
    const dailyExtra = buildDailyFilters(ctx, dailyParams, dailyIdx)
    const monthlyExtra = buildMonthlyFilters(ctx, monthlyParams, monthlyIdx)

    const dailySql = `
      SELECT
        vcl.id,
        vcl.source_type,
        dcc.closing_date AS date,
        dcc.branch_id,
        b.branch_name,
        dcc.position_id,
        pos.position_name,
        dccl.product_id AS item_id,
        p.product_name AS item_name,
        p.category_id,
        c.category_name,
        ABS(vcl.qty)::numeric AS qty,
        COALESCE(dccl.cost_per_unit, 0)::numeric AS unit_cost,
        (ABS(vcl.qty) * COALESCE(dccl.cost_per_unit, 0))::numeric AS total_cost,
        dcc.opname_number AS reference_code,
        vcl.closing_id,
        vcl.monthly_opname_id,
        vcl.department_id,
        dept.department_name,
        COALESCE(vcl.resolve_status, 'UNRESOLVED') AS resolve_status,
        vcl.resolved_at,
        ru.email AS resolved_by_name,
        vcl.resolved_notes,
        vcl.converted_sa_id,
        vcl.deducted_employee_id,
        emp_deducted.full_name AS deducted_employee_name,
        vcl.shortage_assigned_to,
        emp_assigned.full_name AS shortage_assigned_to_name,
        vcl.shortage_note,
        vcl.deduction_amount,
        vcl.deduction_notes,
        vcl.deduction_paid_at,
        vcl.deduction_mode,
        alloc.alloc_count AS division_alloc_count,
        alloc.all_paid AS division_all_paid
      FROM variance_classification_lines vcl
      JOIN daily_closing_count_lines dccl ON dccl.id = vcl.line_id
      JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
      JOIN branches b ON b.id = dcc.branch_id
      LEFT JOIN positions pos ON pos.id = dcc.position_id
      LEFT JOIN departments dept ON dept.id = vcl.department_id
      LEFT JOIN products p ON p.id = dccl.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN auth_users ru ON ru.id = vcl.resolved_by
      LEFT JOIN employees emp_deducted ON emp_deducted.id = vcl.deducted_employee_id
      LEFT JOIN employees emp_assigned ON emp_assigned.id = vcl.shortage_assigned_to
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS alloc_count,
               BOOL_AND(sda.deduction_paid_at IS NOT NULL) AS all_paid
        FROM shortage_deduction_allocations sda
        WHERE sda.vcl_id = vcl.id
      ) alloc ON true
      WHERE vcl.variance_category = 'SHORTAGE'
        AND vcl.source_type = 'DAILY_OPNAME'
        AND dcc.branch_id = ANY($1::uuid[])
        AND dcc.closing_date BETWEEN $2::date AND $3::date
        AND dcc.status IN ('CONFIRMED', 'FLAGGED')
        AND dcc.deleted_at IS NULL
        ${dailyExtra}
    `

    const monthlySql = `
      SELECT
        vcl.id,
        vcl.source_type,
        mso.opname_date AS date,
        mso.branch_id,
        b.branch_name,
        mso.position_id,
        pos.position_name,
        msol.product_id AS item_id,
        p.product_name AS item_name,
        p.category_id,
        c.category_name,
        ABS(vcl.qty)::numeric AS qty,
        COALESCE(msol.cost_per_unit, 0)::numeric AS unit_cost,
        (ABS(vcl.qty) * COALESCE(msol.cost_per_unit, 0))::numeric AS total_cost,
        mso.opname_number AS reference_code,
        NULL::uuid AS closing_id,
        vcl.monthly_opname_id,
        COALESCE(vcl.department_id, pos.department_id) AS department_id,
        dept.department_name,
        COALESCE(vcl.resolve_status, 'UNRESOLVED') AS resolve_status,
        vcl.resolved_at,
        ru.email AS resolved_by_name,
        vcl.resolved_notes,
        vcl.converted_sa_id,
        vcl.deducted_employee_id,
        emp_deducted.full_name AS deducted_employee_name,
        vcl.shortage_assigned_to,
        emp_assigned.full_name AS shortage_assigned_to_name,
        vcl.shortage_note,
        vcl.deduction_amount,
        vcl.deduction_notes,
        vcl.deduction_paid_at,
        vcl.deduction_mode,
        alloc.alloc_count AS division_alloc_count,
        alloc.all_paid AS division_all_paid
      FROM variance_classification_lines vcl
      JOIN monthly_stock_opname_lines msol ON msol.id = vcl.monthly_opname_line_id
      JOIN monthly_stock_opname mso ON mso.id = vcl.monthly_opname_id
      JOIN branches b ON b.id = mso.branch_id
      LEFT JOIN positions pos ON pos.id = mso.position_id
      LEFT JOIN departments dept ON dept.id = COALESCE(vcl.department_id, pos.department_id)
      LEFT JOIN products p ON p.id = msol.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN auth_users ru ON ru.id = vcl.resolved_by
      LEFT JOIN employees emp_deducted ON emp_deducted.id = vcl.deducted_employee_id
      LEFT JOIN employees emp_assigned ON emp_assigned.id = vcl.shortage_assigned_to
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS alloc_count,
               BOOL_AND(sda.deduction_paid_at IS NOT NULL) AS all_paid
        FROM shortage_deduction_allocations sda
        WHERE sda.vcl_id = vcl.id
      ) alloc ON true
      WHERE vcl.variance_category = 'SHORTAGE'
        AND vcl.source_type = 'MONTHLY_OPNAME'
        AND mso.branch_id = ANY($1::uuid[])
        AND mso.opname_date BETWEEN $2::date AND $3::date
        AND mso.status = 'CONFIRMED'
        AND mso.is_deleted = false
        ${monthlyExtra}
    `

    const [dailyRes, monthlyRes] = await Promise.all([
      pool.query(dailySql, dailyParams),
      pool.query(monthlySql, monthlyParams),
    ])

    const merged = [...dailyRes.rows, ...monthlyRes.rows] as ShortageRecord[]
    merged.sort((a, b) => {
      const dateCmp = String(b.date).localeCompare(String(a.date))
      if (dateCmp !== 0) return dateCmp
      return (a.item_name ?? '').localeCompare(b.item_name ?? '')
    })
    return merged
  }

  async getShortageRowById(id: string, branchIds: string[]): Promise<ShortageRecord | null> {
    const rows = await this.getShortageRows({
      branchIds,
      startDate: '2000-01-01',
      endDate: '2099-12-31',
      vclId: id,
    })
    return rows[0] ?? null
  }

  async lockUnresolvedRowsForResolve(
    client: PoolClient,
    vclIds: string[],
    branchIds: string[],
  ): Promise<ShortageRowForResolve[]> {
    const { rows } = await client.query(
      `SELECT
        vcl.id,
        vcl.source_type,
        vcl.closing_id,
        vcl.monthly_opname_id,
        COALESCE(dcc.branch_id, mso.branch_id) AS branch_id,
        COALESCE(dcc.company_id, mso.company_id) AS company_id,
        COALESCE(dcc.warehouse_id, mso.warehouse_id) AS warehouse_id,
        COALESCE(dcc.closing_date, mso.opname_date) AS closing_date,
        COALESCE(dcc.position_id, mso.position_id) AS position_id,
        COALESCE(pos_d.position_name, pos_m.position_name) AS position_name,
        COALESCE(dccl.product_id, msol.product_id) AS product_id,
        COALESCE(dccl.cost_per_unit, msol.cost_per_unit, 0)::numeric AS cost_per_unit,
        ABS(vcl.qty)::numeric AS abs_qty,
        vcl.shortage_assigned_to,
        vcl.shortage_note,
        (ABS(vcl.qty) * COALESCE(dccl.cost_per_unit, msol.cost_per_unit, 0))::numeric AS total_cost,
        COALESCE(vcl.department_id, pos_d.department_id, pos_m.department_id) AS department_id
       FROM variance_classification_lines vcl
       LEFT JOIN daily_closing_count_lines dccl ON dccl.id = vcl.line_id
       LEFT JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
       LEFT JOIN positions pos_d ON pos_d.id = dcc.position_id
       LEFT JOIN monthly_stock_opname_lines msol ON msol.id = vcl.monthly_opname_line_id
       LEFT JOIN monthly_stock_opname mso ON mso.id = vcl.monthly_opname_id
       LEFT JOIN positions pos_m ON pos_m.id = mso.position_id
       WHERE vcl.id = ANY($1::uuid[])
         AND vcl.variance_category = 'SHORTAGE'
         AND COALESCE(vcl.resolve_status, 'UNRESOLVED') = 'UNRESOLVED'
         AND (
           (vcl.source_type = 'DAILY_OPNAME' AND dcc.branch_id = ANY($2::uuid[]) AND dcc.deleted_at IS NULL)
           OR (vcl.source_type = 'MONTHLY_OPNAME' AND mso.branch_id = ANY($2::uuid[]) AND mso.is_deleted = false)
         )
       FOR UPDATE OF vcl`,
      [vclIds, branchIds],
    )
    return rows as ShortageRowForResolve[]
  }

  async markResolved(
    client: PoolClient,
    vclIds: string[],
    data: {
      resolve_status: 'RESOLVED' | 'CONVERTED_TO_WASTE'
      resolved_by: string
      resolved_notes: string | null
      converted_sa_id?: string | null
      deducted_employee_id?: string | null
      deduction_amount?: number | null
      deduction_notes?: string | null
    },
  ): Promise<number> {
    const { rowCount } = await client.query(
      `UPDATE variance_classification_lines
       SET resolve_status = $1,
           resolved_at = now(),
           resolved_by = $2,
           resolved_notes = $3,
           converted_sa_id = $4,
           deducted_employee_id = COALESCE($5, deducted_employee_id, shortage_assigned_to),
           deduction_amount = COALESCE($6, deduction_amount),
           deduction_notes = COALESCE($7, deduction_notes, shortage_note)
       WHERE id = ANY($8::uuid[])
         AND COALESCE(resolve_status, 'UNRESOLVED') = 'UNRESOLVED'`,
      [
        data.resolve_status,
        data.resolved_by,
        data.resolved_notes,
        data.converted_sa_id ?? null,
        data.deducted_employee_id ?? null,
        data.deduction_amount ?? null,
        data.deduction_notes ?? null,
        vclIds,
      ],
    )
    return rowCount ?? 0
  }

  async markResolvedPerRow(
    client: PoolClient,
    rows: Array<{
      id: string
      deducted_employee_id?: string | null
      deduction_amount?: number | null
      deduction_notes?: string | null
      deduction_mode?: 'INDIVIDUAL' | 'DIVISION' | null
      department_id?: string | null
    }>,
    shared: {
      resolve_status: 'RESOLVED'
      resolved_by: string
      resolved_notes: string | null
    },
  ): Promise<void> {
    for (const row of rows) {
      await client.query(
        `UPDATE variance_classification_lines
         SET resolve_status = $1,
             resolved_at = now(),
             resolved_by = $2,
             resolved_notes = $3,
             deducted_employee_id = COALESCE($4, shortage_assigned_to),
             deduction_amount = COALESCE($5, deduction_amount),
             deduction_notes = COALESCE($6, deduction_notes, shortage_note),
             deduction_mode = COALESCE($7, deduction_mode),
             department_id = COALESCE($8, department_id)
         WHERE id = $9`,
        [
          shared.resolve_status,
          shared.resolved_by,
          shared.resolved_notes,
          row.deducted_employee_id ?? null,
          row.deduction_amount ?? null,
          row.deduction_notes ?? null,
          row.deduction_mode ?? 'INDIVIDUAL',
          row.department_id ?? null,
          row.id,
        ],
      )
    }
  }

  async getActiveEmployeesInDepartment(
    client: PoolClient | typeof pool,
    branchId: string,
    departmentId: string,
  ): Promise<DepartmentEmployeePreview[]> {
    const db = 'query' in client ? client : pool
    const { rows } = await db.query(
      `SELECT DISTINCT e.id, e.full_name
       FROM employees e
       JOIN employee_branches eb ON eb.employee_id = e.id
         AND eb.branch_id = $1
         AND eb.status = 'active'
       JOIN positions p ON p.id = eb.position_id
         AND p.department_id = $2
         AND p.is_deleted = false
       WHERE e.is_active = true
         AND e.is_deleted = false
       ORDER BY e.full_name`,
      [branchId, departmentId],
    )
    return rows as DepartmentEmployeePreview[]
  }

  async insertDivisionAllocations(
    client: PoolClient,
    vclId: string,
    departmentId: string,
    employees: DepartmentEmployeePreview[],
    amounts: number[],
    notes: string | null,
  ): Promise<void> {
    for (let i = 0; i < employees.length; i++) {
      await client.query(
        `INSERT INTO shortage_deduction_allocations
           (vcl_id, employee_id, department_id, allocation_amount, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [vclId, employees[i].id, departmentId, amounts[i], notes],
      )
    }
  }

  async getAllocationsInRange(ctx: ShortageQueryContext): Promise<Array<{
    allocation_id: string
    vcl_id: string
    employee_id: string
    employee_name: string
    department_id: string
    department_name: string
    branch_name?: string
    date: string
    item_name?: string
    qty: number
    total_cost: number
    allocation_amount: number
    notes?: string
    deduction_paid_at?: string
    resolve_status: string
    source_type: string
  }>> {
    const params: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    let idx = 4
    let branchFilter = ''
    if (ctx.branchId) {
      params.push(ctx.branchId)
      branchFilter = `AND COALESCE(dcc.branch_id, mso.branch_id) = $${idx++}`
    }

    const { rows } = await pool.query(
      `SELECT
        sda.id AS allocation_id,
        sda.vcl_id,
        sda.employee_id,
        e.full_name AS employee_name,
        sda.department_id,
        dept.department_name,
        b.branch_name,
        COALESCE(dcc.closing_date, mso.opname_date) AS date,
        p.product_name AS item_name,
        ABS(vcl.qty)::numeric AS qty,
        (ABS(vcl.qty) * COALESCE(dccl.cost_per_unit, msol.cost_per_unit, 0))::numeric AS total_cost,
        sda.allocation_amount,
        sda.notes,
        sda.deduction_paid_at,
        COALESCE(vcl.resolve_status, 'UNRESOLVED') AS resolve_status,
        vcl.source_type
       FROM shortage_deduction_allocations sda
       JOIN variance_classification_lines vcl ON vcl.id = sda.vcl_id
       JOIN employees e ON e.id = sda.employee_id
       LEFT JOIN departments dept ON dept.id = sda.department_id
       LEFT JOIN daily_closing_count_lines dccl ON dccl.id = vcl.line_id
       LEFT JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
       LEFT JOIN monthly_stock_opname_lines msol ON msol.id = vcl.monthly_opname_line_id
       LEFT JOIN monthly_stock_opname mso ON mso.id = vcl.monthly_opname_id
       LEFT JOIN branches b ON b.id = COALESCE(dcc.branch_id, mso.branch_id)
       LEFT JOIN products p ON p.id = COALESCE(dccl.product_id, msol.product_id)
       WHERE vcl.variance_category = 'SHORTAGE'
         AND COALESCE(dcc.branch_id, mso.branch_id) = ANY($1::uuid[])
         AND COALESCE(dcc.closing_date, mso.opname_date) BETWEEN $2::date AND $3::date
         ${branchFilter}
       ORDER BY date DESC, e.full_name`,
      params,
    )
    return rows
  }

  async updateAllocationPaid(
    id: string,
    branchIds: string[],
    paid: boolean,
  ): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE shortage_deduction_allocations sda
       SET deduction_paid_at = CASE WHEN $3 THEN now() ELSE NULL END
       FROM variance_classification_lines vcl
       LEFT JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
       LEFT JOIN monthly_stock_opname mso ON mso.id = vcl.monthly_opname_id
       WHERE sda.id = $1
         AND sda.vcl_id = vcl.id
         AND vcl.variance_category = 'SHORTAGE'
         AND (
           (vcl.source_type = 'DAILY_OPNAME' AND dcc.branch_id = ANY($2::uuid[]))
           OR (vcl.source_type = 'MONTHLY_OPNAME' AND mso.branch_id = ANY($2::uuid[]))
         )`,
      [id, branchIds, paid],
    )
    return (rowCount ?? 0) > 0
  }

  async updateDeductionPaid(
    id: string,
    branchIds: string[],
    paid: boolean,
  ): Promise<ShortageRecord | null> {
    const allocationUpdated = await this.updateAllocationPaid(id, branchIds, paid)
    if (allocationUpdated) {
      const { rows } = await pool.query(
        `SELECT sda.vcl_id
         FROM shortage_deduction_allocations sda
         JOIN variance_classification_lines vcl ON vcl.id = sda.vcl_id
         LEFT JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
         LEFT JOIN monthly_stock_opname mso ON mso.id = vcl.monthly_opname_id
         WHERE sda.id = $1
           AND vcl.variance_category = 'SHORTAGE'
           AND (
             (vcl.source_type = 'DAILY_OPNAME' AND dcc.branch_id = ANY($2::uuid[]))
             OR (vcl.source_type = 'MONTHLY_OPNAME' AND mso.branch_id = ANY($2::uuid[]))
           )`,
        [id, branchIds],
      )
      if (rows.length === 0) return null
      return this.getShortageRowById(rows[0].vcl_id as string, branchIds)
    }

    const { rows } = await pool.query(
      `UPDATE variance_classification_lines vcl
       SET deduction_paid_at = CASE WHEN $3 THEN now() ELSE NULL END
       WHERE vcl.id = $1
         AND vcl.variance_category = 'SHORTAGE'
         AND (vcl.deducted_employee_id IS NOT NULL OR vcl.shortage_assigned_to IS NOT NULL)
         AND (
           EXISTS (
             SELECT 1 FROM daily_closing_counts dcc
             WHERE dcc.id = vcl.closing_id AND dcc.branch_id = ANY($2::uuid[])
           )
           OR EXISTS (
             SELECT 1 FROM monthly_stock_opname mso
             WHERE mso.id = vcl.monthly_opname_id AND mso.branch_id = ANY($2::uuid[])
           )
         )
       RETURNING vcl.id`,
      [id, branchIds, paid],
    )
    if (rows.length === 0) return null

    return this.getShortageRowById(id, branchIds)
  }
}

export const shortageReportRepository = new ShortageReportRepository()
