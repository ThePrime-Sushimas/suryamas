import { branchesRepository } from './branches.repository'
import type { Branch, CreateBranchDto, UpdateBranchDto } from './branches.types'
import { BranchErrors } from './branches.errors'
import type { CreateBranchInput, UpdateBranchInput } from './branches.schema'
import { AuditService } from '../monitoring/monitoring.service'
import { logInfo } from '../../config/logger'

interface SortInfo { field: string; order: 'asc' | 'desc' }
interface FilterInfo { status?: string; company_id?: string; city?: string; hari_operasional?: string }

export class BranchesService {
  async list(pagination: { page: number; limit: number; offset: number }, sort?: SortInfo, filter?: FilterInfo) {
    const { data, total } = await branchesRepository.findAll(
      { limit: pagination.limit, offset: pagination.offset },
      sort,
      filter
    )

    return {
      data: data.map(b => this.normalizeBranch(b)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page < Math.ceil(total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    }
  }

  async search(q: string, pagination: { page: number; limit: number; offset: number }, sort?: SortInfo, filter?: FilterInfo) {
    const { data, total } = await branchesRepository.search(
      q,
      { limit: pagination.limit, offset: pagination.offset },
      sort,
      filter
    )

    return {
      data: data.map(b => this.normalizeBranch(b)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page < Math.ceil(total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    }
  }

  async create(dto: CreateBranchInput, userId?: string): Promise<Branch> {
    const existing = await branchesRepository.findByBranchCode(dto.branch_code)
    if (existing) throw BranchErrors.CODE_EXISTS(dto.branch_code)

    const data: CreateBranchDto = {
      company_id: dto.company_id,
      branch_code: dto.branch_code,
      branch_name: dto.branch_name,
      address: dto.address,
      city: dto.city,
      province: dto.province ?? null,
      postal_code: dto.postal_code ?? null,
      country: dto.country,
      status: dto.status,
      jam_buka: dto.jam_buka,
      jam_tutup: dto.jam_tutup,
      hari_operasional: dto.hari_operasional,
      phone: dto.phone ?? null,
      whatsapp: dto.whatsapp ?? null,
      email: dto.email ?? null,
      manager_id: dto.manager_id ?? null,
      notes: dto.notes ?? null,
    }

    const branch = await branchesRepository.create({ ...data, created_by: userId, updated_by: userId })

    if (userId) {
      await AuditService.log('CREATE', 'branch', branch.id, userId, undefined, branch)
    }

    logInfo('Branch created', { id: branch.id, code: branch.branch_code })
    return branch
  }

  async update(id: string, dto: UpdateBranchInput, userId?: string): Promise<Branch> {
    const branch = await branchesRepository.findById(id)
    if (!branch) throw BranchErrors.NOT_FOUND()

    const updates: UpdateBranchDto = {
      ...Object.fromEntries(
        Object.entries(dto).filter(([, v]) => v !== undefined)
      ) as UpdateBranchDto,
      updated_by: userId,
    }

    const updated = await branchesRepository.updateById(id, updates)

    if (userId) {
      await AuditService.log('UPDATE', 'branch', id, userId, branch, dto)
    }

    logInfo('Branch updated', { id })
    return updated!
  }

  async getById(id: string): Promise<Branch> {
    const branch = await branchesRepository.findById(id)
    if (!branch) throw BranchErrors.NOT_FOUND()
    return this.normalizeBranch(branch)
  }

  private normalizeBranch(branch: Branch): Branch {
    return {
      ...branch,
      hari_operasional: this.normalizeHariOperasional(branch.hari_operasional)
    }
  }

  private normalizeHariOperasional(value: unknown): string[] {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  async delete(id: string, userId?: string): Promise<void> {
    const branch = await branchesRepository.findById(id)
    if (!branch) throw BranchErrors.NOT_FOUND()

    await branchesRepository.delete(id)

    if (userId) {
      await AuditService.log('DELETE', 'branch', id, userId)
    }

    logInfo('Branch deleted', { id })
  }

  async bulkUpdateStatus(ids: string[], status: string, userId?: string): Promise<void> {
    const validStatuses = ['active', 'inactive']
    if (!validStatuses.includes(status)) throw BranchErrors.INVALID_STATUS(status)

    await branchesRepository.bulkUpdateStatus(ids, status)

    if (userId) {
      await AuditService.log('UPDATE', 'branch', ids.join(','), userId, undefined, { status })
    }

    logInfo('Bulk status update', { count: ids.length, status })
  }

  async getFilterOptions() {
    return branchesRepository.getFilterOptions()
  }

  async minimalActive(): Promise<{ id: string; branch_name: string }[]> {
    return branchesRepository.minimalActive()
  }

  async closeBranch(id: string, userId: string, reason: string, closedDate: string): Promise<Branch> {
    const branch = await branchesRepository.findById(id)
    if (!branch) throw BranchErrors.NOT_FOUND(id)
    if (branch.status === 'closed') throw BranchErrors.ALREADY_CLOSED(id, branch.branch_name)

    const [pendingJournals, openCashCounts, processingImports] = await Promise.all([
      branchesRepository.countPendingJournals(id),
      branchesRepository.countOpenCashCounts(branch.branch_name),
      branchesRepository.countProcessingPosImports(id),
    ])

    if (pendingJournals > 0 || openCashCounts > 0 || processingImports > 0) {
      throw BranchErrors.PENDING_DATA(branch.branch_name, {
        journals: pendingJournals,
        cashCounts: openCashCounts,
        posImports: processingImports,
      })
    }

    const closed = await branchesRepository.closeBranch(id, userId, reason, closedDate)
    if (!closed) throw BranchErrors.NOT_FOUND(id)

    const { invalidateBranchContextCache } = await import('../../middleware/branch-context.middleware')
    invalidateBranchContextCache(undefined, id)

    await AuditService.log('CLOSE', 'branch', id, userId,
      { status: branch.status },
      { status: 'closed', closed_at: closed.closed_at, reason }
    )

    logInfo('Branch closed permanently', { id, branch_name: branch.branch_name, closed_by: userId })
    return closed
  }
}

export const branchesService = new BranchesService()
