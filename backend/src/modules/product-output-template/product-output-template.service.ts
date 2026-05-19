// ── Service ───────────────────────────────────────────────────────────────────
 
import { productOutputTemplateRepository } from './product-output-template.repository'
import type { UpsertOutputTemplateDto } from './product-output-template.repository'
 
export class ProductOutputTemplateService {
  async getTemplate(productId: string) {
    return productOutputTemplateRepository.findByProductId(productId)
  }
 
  async saveTemplate(productId: string, items: UpsertOutputTemplateDto[], userId: string) {
    await productOutputTemplateRepository.withTransaction(async (client) => {
      await productOutputTemplateRepository.replaceTemplate(client, productId, items, userId)
    })
    return productOutputTemplateRepository.findByProductId(productId)
  }
}
 
export const productOutputTemplateService = new ProductOutputTemplateService()
 