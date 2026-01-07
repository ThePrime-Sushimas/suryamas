import { branchesRepository } from './branches.repository'
import { Branch, CreateBranchDto } from './branches.types'
import { BranchErrors } from './branches.errors'
import { CreateBranchInput, UpdateBranchInput } from './branches.schema'
import { AuditService } from '../../services/audit.service'
import { logInfo } from '../../config/logger'

export class BranchesService {
  async list(pagination: { page: number; limit: number; offset: number }, sort?: any, filter?: any) {
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

  async search(q: string, pagination: { page: number; limit: number; offset: number }, sort?: any, filter?: any) {
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
    if (existing) throw BranchErrors.CODE_EXISTS()

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

    const branch = await branchesRepository.create({ ...data, created_by: userId, updated_by: userId } as any)

    if (userId) {
      await AuditService.log('CREATE', 'branch', branch.id, userId, undefined, branch)
    }

    logInfo('Branch created', { id: branch.id, code: branch.branch_code })
    return branch
  }

  async update(id: string, dto: UpdateBranchInput, userId?: string): Promise<Branch> {
    const branch = await branchesRepository.findById(id)
    if (!branch) throw BranchErrors.NOT_FOUND()

    const updated = await branchesRepository.updateById(id, { ...dto, updated_by: userId } as any)

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

  private normalizeHariOperasional(value: any): string[] {
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
}

export const branchesService = new BranchesService()
