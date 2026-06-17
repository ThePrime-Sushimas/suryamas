import type { PoolClient } from 'pg'

/**
 * Generates a unique asset code in the format: {category_code}-{branch_code}-{sequence}
 * Sequence is per-company, per-category, zero-padded to 4 digits.
 * Example: ITE-JKT001-0001, ITE-JKT001-0002
 *
 * Uses advisory lock for transactional safety to prevent duplicate sequences
 * under concurrent inserts.
 */
export async function generateAssetCode(
  client: PoolClient,
  companyId: string,
  categoryCode: string,
  branchCode: string,
): Promise<string> {
  const prefix = `${categoryCode}-${branchCode}`

  // Advisory lock scoped to company + category to prevent race conditions
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `asset-code-${companyId}-${categoryCode}`,
  ])

  // Find the current max sequence for this company + category prefix.
  // Numeric extraction via regexp_match ensures correct numeric ordering
  // (string ORDER BY would sort '0100' < '099' wrongly).
  // The `asset_code ~ '-\d+$'` guard excludes any legacy rows with non-numeric
  // suffixes so the ::int cast never throws.
  const { rows } = await client.query(
    `SELECT asset_code,
            (regexp_match(asset_code, '-([0-9]+)$'))[1]::int AS seq
     FROM fixed_assets
     WHERE company_id = $1
       AND asset_code LIKE $2
       AND asset_code ~ '-[0-9]+$'
       AND deleted_at IS NULL
     ORDER BY (regexp_match(asset_code, '-([0-9]+)$'))[1]::int DESC
     LIMIT 1`,
    [companyId, `${prefix}-%`],
  )

  let nextSeq = 1
  if (rows.length > 0) {
    // seq is already an int from the DB cast; no further parsing needed
    nextSeq = (rows[0].seq as number) + 1
  }

  return `${prefix}-${String(nextSeq).padStart(4, '0')}`
}
