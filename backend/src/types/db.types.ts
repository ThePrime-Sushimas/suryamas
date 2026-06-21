import type { Pool, PoolClient } from 'pg'

/** Queryable interface shared by Pool and PoolClient — use for `client ?? pool` patterns. */
export type Queryable = Pick<Pool, 'query'> | PoolClient
