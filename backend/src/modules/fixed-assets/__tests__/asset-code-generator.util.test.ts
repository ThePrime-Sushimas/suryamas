import { describe, it, expect } from '@jest/globals'
import type { PoolClient } from 'pg'
import { generateAssetCode } from '../asset-code-generator.util'

/**
 * @param lastSeq - the integer sequence the DB would return after regexp_match cast.
 *                  Pass null to simulate no existing rows.
 *                  Pass NaN to simulate a row where seq cannot be determined
 *                  (should not happen after the regex guard, but kept for safety).
 */
function mockClientWithLastSeq(lastSeq: number | null): PoolClient {
  const calls: Array<{ sql: string; params?: unknown[] }> = []

  const client = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      if (sql.includes('SELECT asset_code')) {
        return {
          rows: lastSeq !== null ? [{ asset_code: `CAT-BR-${String(lastSeq).padStart(4, '0')}`, seq: lastSeq }] : [],
        }
      }
      return { rows: [] }
    },
  } as unknown as PoolClient

  ;(client as any).__calls = calls
  return client
}

describe('generateAssetCode()', () => {
  it('generates CAT-BR-0001 when no existing code', async () => {
    const client = mockClientWithLastSeq(null)
    const code = await generateAssetCode(client, 'company-1', 'CAT', 'BR')
    expect(code).toBe('CAT-BR-0001')
  })

  it('increments sequence and keeps 4-digit padding', async () => {
    const client = mockClientWithLastSeq(99)
    const code = await generateAssetCode(client, 'company-1', 'CAT', 'BR')
    expect(code).toBe('CAT-BR-0100')
  })

  it('generates 5-digit code when sequence exceeds 9999', async () => {
    const client = mockClientWithLastSeq(9999)
    const code = await generateAssetCode(client, 'company-1', 'CAT', 'BR')
    // padStart(4) only pads to minimum 4 chars; 10000 is already 5 chars, that's fine
    expect(code).toBe('CAT-BR-10000')
  })

  it('starts from 0001 when no rows returned (SQL regex guard excluded all legacy rows)', async () => {
    const client = mockClientWithLastSeq(null)
    const code = await generateAssetCode(client, 'company-1', 'CAT', 'BR')
    expect(code).toBe('CAT-BR-0001')
  })
})
