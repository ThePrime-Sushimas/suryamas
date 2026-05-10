import type { Request, Response } from 'express'
import { pool } from '../../../config/db'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { wipPositionAccessSchema } from './wip.schema'

type SetReq = ValidatedAuthRequest<typeof wipPositionAccessSchema>

class WipPositionAccessController {

  /** GET /wip-items/:id/position-access — list positions assigned to this WIP */
  get = async (req: Request, res: Response) => {
    try {
      const wipId = req.params.id
      const { rows } = await pool.query(`
        SELECT wpa.position_id, p.position_code, p.position_name, d.department_name
        FROM wip_position_access wpa
        JOIN positions p ON p.id = wpa.position_id
        JOIN departments d ON d.id = p.department_id
        WHERE wpa.wip_id = $1
        ORDER BY d.sort_order, p.sort_order
      `, [wipId])
      sendSuccess(res, rows, 'WIP position access retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_wip_position_access', id: req.params.id })
    }
  }

  /** PUT /wip-items/:id/position-access — replace all position access for this WIP */
  set = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as SetReq).validated
      const wipId = params.id
      const { position_ids } = body

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Delete all existing
        await client.query(`DELETE FROM wip_position_access WHERE wip_id = $1`, [wipId])

        // Insert new (if any — empty array means "all positions can access")
        if (position_ids && position_ids.length > 0) {
          const values = position_ids.map((_, i) => `($1, $${i + 2})`).join(', ')
          await client.query(
            `INSERT INTO wip_position_access (wip_id, position_id) VALUES ${values} ON CONFLICT DO NOTHING`,
            [wipId, ...position_ids]
          )
        }

        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }

      sendSuccess(res, null, 'WIP position access updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'set_wip_position_access', id: req.params.id })
    }
  }
}

export const wipPositionAccessController = new WipPositionAccessController()
