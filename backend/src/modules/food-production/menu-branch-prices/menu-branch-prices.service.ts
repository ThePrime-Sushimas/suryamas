import { menuBranchPricesRepository } from './menu-branch-prices.repository'
import { MenuBranchPriceNotFoundError } from './menu-branch-prices.errors'
import { AuditService } from '../../monitoring/monitoring.service'
import type { CreateMenuBranchPriceDto, UpdateMenuBranchPriceDto, MenuBranchPriceWithBranch, MenuBranchPrice, SyncFromPosResult } from './menu-branch-prices.types'

export class MenuBranchPricesService {
  async getById(id: string, companyIds: string[]): Promise<MenuBranchPrice> {
    const record = await menuBranchPricesRepository.findByIdAccessible(id, companyIds)
    if (!record) throw new MenuBranchPriceNotFoundError(id)
    return record
  }

  async listByMenu(menuId: string, companyId: string): Promise<MenuBranchPriceWithBranch[]> {
    return menuBranchPricesRepository.findByMenuId(menuId, companyId)
  }

  async upsert(companyId: string, dto: CreateMenuBranchPriceDto, userId: string): Promise<MenuBranchPrice> {
    const result = await menuBranchPricesRepository.upsert(companyId, { ...dto, created_by: userId, updated_by: userId })
    await AuditService.log('CREATE', 'menu_branch_price', result.id, userId, undefined, result)
    return result
  }

  async update(id: string, companyId: string, dto: UpdateMenuBranchPriceDto, userId: string, existing?: MenuBranchPrice): Promise<MenuBranchPrice> {
    const record = existing ?? await menuBranchPricesRepository.findById(id, companyId)
    if (!record) throw new MenuBranchPriceNotFoundError(id)

    const updated = await menuBranchPricesRepository.update(id, companyId, { ...dto, updated_by: userId })
    if (!updated) throw new MenuBranchPriceNotFoundError(id)

    await AuditService.log('UPDATE', 'menu_branch_price', id, userId, record, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string, existing?: MenuBranchPrice): Promise<void> {
    const record = existing ?? await menuBranchPricesRepository.findById(id, companyId)
    if (!record) throw new MenuBranchPriceNotFoundError(id)

    await menuBranchPricesRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'menu_branch_price', id, userId, record)
  }

  async syncFromPos(companyId: string, userId: string, menuId?: string): Promise<SyncFromPosResult> {
    const result = await menuBranchPricesRepository.syncFromPos(companyId, menuId)
    await AuditService.log('UPDATE', 'menu_branch_price_sync', 'bulk', userId, undefined, result)
    return result
  }
}

export const menuBranchPricesService = new MenuBranchPricesService()
