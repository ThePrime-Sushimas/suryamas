import { branchesRepository } from './branches.repository'
import { Branch, CreateBranchDto, UpdateBranchDto, BranchStatus } from './branches.types'
import { AuditService } from '../../services/audit.service'
import { logError, logInfo } from '../../config/logger'

const VALID_STATUSES: BranchStatus[] = ['active', 'inactive', 'maintenance', 'closed']

const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const validatePhone = (phone: string): boolean => /^[0-9+\-\s()]{6,20}$/.test(phone)
const validateCoordinates = (lat: number, lon: number): boolean =>
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180

export class BranchesService {
  async list(
    pagination: { page: number; limit: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await branchesRepository.findAll(
      { limit: pagination.limit, offset },
      sort,
      filter
    )

    return {
      data,
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

  async search(
    q: string,
    pagination: { page: number; limit: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await branchesRepository.search(q, { limit: pagination.limit, offset }, sort, filter)

    return {
      data,
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

  async create(dto: CreateBranchDto, userId?: string): Promise<Branch> {
    // Validate required fields
    if (!dto.company_id || !dto.branch_code || !dto.branch_name || !dto.address || !dto.city) {
      throw new Error('Missing required fields: company_id, branch_code, branch_name, address, city')
    }

    // Validate status
    if (dto.status && !VALID_STATUSES.includes(dto.status)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    // Validate email
    if (dto.email && !validateEmail(dto.email)) {
      throw new Error('Invalid email format')
    }

    // Validate phone
    if (dto.phone && !validatePhone(dto.phone)) {
      throw new Error('Invalid phone format')
    }

    if (dto.whatsapp && !validatePhone(dto.whatsapp)) {
      throw new Error('Invalid WhatsApp format')
    }

    // Validate coordinates
    if ((dto.latitude || dto.longitude) && !validateCoordinates(dto.latitude || 0, dto.longitude || 0)) {
      throw new Error('Invalid coordinates. Latitude must be -90 to 90, Longitude must be -180 to 180')
    }

    // Check unique branch_code
    const existing = await branchesRepository.findByBranchCode(dto.branch_code)
    if (existing) {
      throw new Error('Branch code already exists')
    }

    // Set defaults
    const data: any = {
      ...dto,
      province: dto.province || 'DKI Jakarta',
      country: dto.country || 'Indonesia',
      status: dto.status || 'active',
      jam_buka: dto.jam_buka || '10:00:00',
      jam_tutup: dto.jam_tutup || '22:00:00',
      hari_operasional: dto.hari_operasional || 'Senin-Minggu',
      created_by: userId,
      updated_by: userId,
    }

    const branch = await branchesRepository.create(data)

    if (userId) {
      await AuditService.log('CREATE', 'branch', branch.id, userId, undefined, branch)
    }

    logInfo('Branch created', { id: branch.id, code: branch.branch_code })
    return branch
  }

  async update(id: string, dto: UpdateBranchDto, userId?: string): Promise<Branch | null> {
    // Prevent branch_code update
    if ('branch_code' in dto) {
      throw new Error('Branch code cannot be updated')
    }

    // Validate status if provided
    if (dto.status && !VALID_STATUSES.includes(dto.status)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    // Validate email if provided
    if (dto.email && !validateEmail(dto.email)) {
      throw new Error('Invalid email format')
    }

    // Validate phone if provided
    if (dto.phone && !validatePhone(dto.phone)) {
      throw new Error('Invalid phone format')
    }

    if (dto.whatsapp && !validatePhone(dto.whatsapp)) {
      throw new Error('Invalid WhatsApp format')
    }

    // Validate coordinates if provided
    if ((dto.latitude || dto.longitude) && !validateCoordinates(dto.latitude || 0, dto.longitude || 0)) {
      throw new Error('Invalid coordinates')
    }

    const data: any = { ...dto, updated_by: userId }
    const branch = await branchesRepository.updateById(id, data)

    if (branch && userId) {
      await AuditService.log('UPDATE', 'branch', id, userId, undefined, dto)
    }

    logInfo('Branch updated', { id })
    return branch
  }

  async getById(id: string): Promise<Branch | null> {
    return branchesRepository.findById(id)
  }

  async delete(id: string, userId?: string): Promise<void> {
    try {
      await branchesRepository.delete(id)

      if (userId) {
        await AuditService.log('DELETE', 'branch', id, userId)
      }

      logInfo('Branch deleted', { id })
    } catch (error: any) {
      logError('Delete branch failed', { id, error: error.message })
      throw error
    }
  }

  async bulkUpdateStatus(ids: string[], status: BranchStatus, userId?: string): Promise<void> {
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    await branchesRepository.bulkUpdateStatus(ids, status)

    if (userId) {
      await AuditService.log('UPDATE', 'branch', ids.join(','), userId, undefined, { status })
    }

    logInfo('Bulk status update', { count: ids.length, status })
  }

  async exportToExcel(filter?: any): Promise<Branch[]> {
    return branchesRepository.exportData(filter)
  }

  async getFilterOptions() {
    return branchesRepository.getFilterOptions()
  }

  async minimalActive(): Promise<{ id: string; branch_name: string }[]> {
    return branchesRepository.minimalActive()
  }
}

export const branchesService = new BranchesService()
