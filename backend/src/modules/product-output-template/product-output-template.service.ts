// ── Service ───────────────────────────────────────────────────────────────────
 
import { pool } from '../../config/db'
import { productOutputTemplateRepository } from './product-output-template.repository'
import type { UpsertOutputTemplateDto } from './product-output-template.repository'
 
export class ProductOutputTemplateService {
  async getTemplate(productId: string) {
    return productOutputTemplateRepository.findByProductId(productId)
  }
 
  async saveTemplate(productId: string, items: UpsertOutputTemplateDto[], userId: string) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await productOutputTemplateRepository.replaceTemplate(client, productId, items, userId)
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
    return productOutputTemplateRepository.findByProductId(productId)
  }
}
 
export const productOutputTemplateService = new ProductOutputTemplateService()
 