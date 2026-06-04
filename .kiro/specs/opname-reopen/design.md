# Design Document: Opname Reopen

## Overview

The opname reopen feature extends the existing `daily-stock-opname` module with a request–approval workflow. A PIC can request permission to re-edit a confirmed/flagged session, an approver can approve or reject, and upon approval the system reverses stock movements, clears classifications, and transitions the session to REOPENED status for re-editing.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend                                      │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────┐  │
│  │ ReopenButton │   │ ReopenApprovalUI │   │ SessionDetailPage  │  │
│  │ (PIC view)   │   │ (Approver view)  │   │ (status display)   │  │
│  └──────┬───────┘   └────────┬─────────┘   └────────────────────┘  │
└─────────┼────────────────────┼──────────────────────────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            daily-stock-opname.routes.ts                        │   │
│  │  POST /api/v1/daily-stock-opname/:id/reopen-request           │   │
│  │  POST /api/v1/daily-stock-opname/reopen-requests/:id/approve  │   │
│  │  POST /api/v1/daily-stock-opname/reopen-requests/:id/reject   │   │
│  │  GET  /api/v1/daily-stock-opname/:id/reopen-requests          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Service Layer                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         daily-stock-opname-reopen.service.ts                   │   │
│  │  • createReopenRequest(sessionId, userId, reason)              │   │
│  │  • approveReopenRequest(requestId, userId, note?)              │   │
│  │  • rejectReopenRequest(requestId, userId, note?)               │   │
│  │  • getReopenRequests(sessionId)                                │   │
│  └──────────┬───────────────────────────────────────────────────┘   │
│             │                                                        │
│             ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         daily-stock-opname-reopen.repository.ts                │   │
│  │  • insertRequest(client, data)                                 │   │
│  │  • findPendingByClosingId(closingId)                           │   │
│  │  • findById(requestId)                                         │   │
│  │  • updateStatus(client, requestId, data)                       │   │
│  │  • findByClosingId(closingId)                                  │   │
│  │  • getMovementsByClosingId(client, closingId)                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────┐  ┌────────────────────────┐                 │
│  │  stockRepository   │  │ classificationRepo     │                 │
│  │  (counter-moves)   │  │ (deleteByClosingId)    │                 │
│  └────────────────────┘  └────────────────────────┘                 │
│                                                                      │
│  ┌────────────────────┐  ┌────────────────────────┐                 │
│  │  AuditService      │  │ notificationDispatcher │                 │
│  └────────────────────┘  └────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Database                                         │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐    │
│  │ opname_reopen_   │  │ daily_closing_counts                  │    │
│  │ requests         │  │ (status: DRAFT|CONFIRMED|FLAGGED|     │    │
│  │                  │  │          REOPENED)                     │    │
│  └──────────────────┘  └──────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐    │
│  │ stock_movements  │  │ variance_classification_lines         │    │
│  │ (IN/OUT_REVERSAL)│  │ (deleted on reopen)                   │    │
│  └──────────────────┘  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

## Data Models

### New Table: `opname_reopen_requests`

```sql
CREATE TABLE opname_reopen_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id    UUID NOT NULL REFERENCES daily_closing_counts(id),
  requested_by  UUID NOT NULL REFERENCES users(id),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason        TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  responded_by  UUID REFERENCES users(id),
  responded_at  TIMESTAMPTZ,
  response_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reopen_requests_closing_id ON opname_reopen_requests(closing_id);
CREATE INDEX idx_reopen_requests_status ON opname_reopen_requests(status);
```

### Modified Table: `daily_closing_counts`

Add `REOPENED` to the status CHECK constraint:

```sql
ALTER TABLE daily_closing_counts
  DROP CONSTRAINT IF EXISTS daily_closing_counts_status_check,
  ADD CONSTRAINT daily_closing_counts_status_check
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'FLAGGED', 'REOPENED'));
```

### New Stock Movement Types

```sql
-- Add to movement_type CHECK constraint on stock_movements table
-- IN_REVERSAL: reverses an OUT_WASTE movement
-- OUT_REVERSAL: reverses an IN_ADJUSTMENT movement
```

## TypeScript Interfaces

```typescript
// ─── REOPEN TYPES ─────────────────────────────────────────────────────────────

export type ReopenRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface OpnameReopenRequest {
  id: string
  closing_id: string
  requested_by: string
  requested_at: string
  reason: string
  status: ReopenRequestStatus
  responded_by: string | null
  responded_at: string | null
  response_note: string | null
  created_at: string
  updated_at: string
}

export interface OpnameReopenRequestWithRelations extends OpnameReopenRequest {
  requested_by_name: string
  responded_by_name: string | null
  closing_date: string
  branch_name: string
}

export interface CreateReopenRequestDto {
  reason: string
}

export interface RespondReopenRequestDto {
  response_note?: string
}

// Extend existing OpnameStatus type
export type OpnameStatus = 'DRAFT' | 'CONFIRMED' | 'FLAGGED' | 'REOPENED'
```

## API Endpoints

### POST `/api/v1/daily-stock-opname/:id/reopen-request`

Creates a reopen request for the specified session.

**Auth:** Requires `canView('daily_stock_opname')` — only the PIC of the session can request.

**Request Body:**
```typescript
{ reason: string } // non-empty, validated by Zod
```

**Response (201):**
```typescript
{
  success: true,
  message: 'Permintaan edit ulang berhasil diajukan',
  data: OpnameReopenRequestWithRelations
}
```

**Errors:**
- 400: Session not CONFIRMED/FLAGGED
- 409: Pending request already exists
- 422: Empty reason

### POST `/api/v1/daily-stock-opname/reopen-requests/:id/approve`

Approves a pending reopen request. Triggers stock reversal + classification deletion.

**Auth:** Requires `canUpdate('daily_stock_opname')` + `approve` permission check in service.

**Request Body:**
```typescript
{ response_note?: string }
```

**Response (200):**
```typescript
{
  success: true,
  message: 'Permintaan edit ulang disetujui',
  data: OpnameReopenRequestWithRelations
}
```

**Errors:**
- 400: Request not PENDING
- 403: User doesn't have approve permission
- 404: Request not found

### POST `/api/v1/daily-stock-opname/reopen-requests/:id/reject`

Rejects a pending reopen request. No stock changes occur.

**Auth:** Requires `canUpdate('daily_stock_opname')` + `approve` permission check in service.

**Request Body:**
```typescript
{ response_note?: string }
```

**Response (200):**
```typescript
{
  success: true,
  message: 'Permintaan edit ulang ditolak',
  data: OpnameReopenRequestWithRelations
}
```

### GET `/api/v1/daily-stock-opname/:id/reopen-requests`

Lists all reopen requests for a session (for audit trail).

**Auth:** Requires `canView('daily_stock_opname')`.

**Response (200):**
```typescript
{
  success: true,
  data: OpnameReopenRequestWithRelations[]
}
```

## Service Layer Design

### `daily-stock-opname-reopen.service.ts`

```typescript
import { dailyStockOpnameRepository } from './daily-stock-opname.repository'
import { reopenRepository } from './daily-stock-opname-reopen.repository'
import { classificationRepository } from './daily-stock-opname-classification.repository'
import { stockRepository } from '../stock/stock.repository'
import { AuditService } from '../monitoring/monitoring.service'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import { requireBranchAccess, getCompanyIdForBranch } from '../../utils/branch-access.util'
import { BusinessRuleError, ForbiddenError } from '../../utils/errors.base'

export class DailyStockOpnameReopenService {

  /**
   * Creates a reopen request for a confirmed/flagged session.
   *
   * Validations:
   * 1. Session exists and user has branch access
   * 2. Session status is CONFIRMED or FLAGGED
   * 3. No existing PENDING request for this session
   * 4. Reason is non-empty (validated by Zod schema)
   *
   * Side effects:
   * - Inserts record into opname_reopen_requests
   * - Dispatches OPNAME_REOPEN_REQUESTED notification to approvers
   * - Logs audit entry
   */
  async createReopenRequest(
    sessionId: string,
    branchIds: string[],
    userId: string,
    dto: CreateReopenRequestDto,
  ): Promise<OpnameReopenRequestWithRelations> { /* ... */ }

  /**
   * Approves a pending reopen request. This is the critical operation that:
   * 1. Updates request status to APPROVED
   * 2. Creates counter-movements for all session stock movements
   * 3. Updates stock balances to reflect reversals
   * 4. Deletes all variance classification entries
   * 5. Changes session status to REOPENED
   *
   * All within a single transaction for atomicity.
   */
  async approveReopenRequest(
    requestId: string,
    branchIds: string[],
    userId: string,
    dto: RespondReopenRequestDto,
  ): Promise<OpnameReopenRequestWithRelations> { /* ... */ }

  /**
   * Rejects a pending reopen request. No stock changes occur.
   * Simply updates request status and allows future requests.
   */
  async rejectReopenRequest(
    requestId: string,
    branchIds: string[],
    userId: string,
    dto: RespondReopenRequestDto,
  ): Promise<OpnameReopenRequestWithRelations> { /* ... */ }

  /**
   * Returns all reopen requests for a session (audit trail).
   */
  async getReopenRequests(
    sessionId: string,
    branchIds: string[],
  ): Promise<OpnameReopenRequestWithRelations[]> { /* ... */ }
}
```

### Approval Transaction Flow (Critical Path)

```typescript
async approveReopenRequest(requestId, branchIds, userId, dto) {
  // 1. Fetch and validate request
  const request = await reopenRepository.findById(requestId)
  if (!request) throw new NotFoundError()
  if (request.status !== 'PENDING') throw new BusinessRuleError('already responded')

  // 2. Fetch session and validate branch access + approve permission
  const session = await dailyStockOpnameRepository.findByIdAccessible(request.closing_id, branchIds)
  if (!session) throw new NotFoundError()
  await this.validateApprovePermission(userId, session.branch_id)

  const companyId = await getCompanyIdForBranch(session.branch_id)

  // 3. Execute within transaction
  await reopenRepository.withTransaction(async (client) => {
    // 3a. Update request status
    await reopenRepository.updateStatus(client, requestId, {
      status: 'APPROVED',
      responded_by: userId,
      responded_at: new Date().toISOString(),
      response_note: dto.response_note ?? null,
    })

    // 3b. Fetch original stock movements for this session
    const movements = await reopenRepository.getMovementsByClosingId(client, request.closing_id)

    // 3c. Create counter-movements and update balances
    for (const movement of movements) {
      const reversalType = movement.movement_type === 'OUT_WASTE'
        ? 'IN_REVERSAL'
        : 'OUT_REVERSAL'  // for IN_ADJUSTMENT

      // Get current balance for the product
      const balance = await stockRepository.getBalanceForUpdate(
        client, session.warehouse_id, movement.product_id)
      const currentQty = balance ? Number(balance.qty) : 0
      const currentAvgCost = balance ? Number(balance.avg_cost) : 0

      let newQty: number
      let newAvgCost: number

      if (reversalType === 'IN_REVERSAL') {
        // Reversing OUT_WASTE: add qty back
        newQty = currentQty + Number(movement.qty)
        newAvgCost = newQty > 0
          ? (currentQty * currentAvgCost + Number(movement.qty) * Number(movement.cost_per_unit)) / newQty
          : Number(movement.cost_per_unit)
      } else {
        // Reversing IN_ADJUSTMENT: subtract qty
        newQty = currentQty - Number(movement.qty)
        newAvgCost = currentAvgCost // avg cost doesn't change on OUT
      }

      await stockRepository.createMovement(client, {
        warehouse_id: session.warehouse_id,
        product_id: movement.product_id,
        movement_type: reversalType,
        qty: Number(movement.qty),
        cost_per_unit: Number(movement.cost_per_unit),
        reference_type: 'daily_closing_count',
        reference_id: request.closing_id,
        notes: `Reversal opname reopen - ${movement.movement_type}`,
        movement_date: session.closing_date,
        created_by: userId,
      }, newQty)

      await stockRepository.upsertBalance(
        client, session.warehouse_id, movement.product_id, newQty, newAvgCost)
    }

    // 3d. Delete variance classifications
    await classificationRepository.deleteByClosingId(client, request.closing_id)

    // 3e. Update session status to REOPENED
    await dailyStockOpnameRepository.updateHeaderStatus(client, request.closing_id, {
      status: 'REOPENED',
      updated_by: userId,
    })
  })

  // 4. Audit log
  await AuditService.log('UPDATE', 'opname_reopen_request', requestId, userId,
    { status: 'PENDING' }, { status: 'APPROVED' })

  // 5. Return updated request
  return reopenRepository.findByIdWithRelations(requestId)
}
```

### Modification to Existing Confirm Flow

The existing `confirmSession` method in `daily-stock-opname.service.ts` needs to accept REOPENED status in addition to DRAFT:

```typescript
// In confirmSession method, change:
// if (session.status !== 'DRAFT') throw new OpnameNotDraftError(session.status)
// To:
if (session.status !== 'DRAFT' && session.status !== 'REOPENED') {
  throw new OpnameNotDraftError(session.status)
}

// Skip time validation when REOPENED:
if (session.status !== 'REOPENED') {
  if (this.isSessionExpired(session)) {
    throw new OpnameSessionExpiredError(session.closing_date)
  }
  await this.validateTimeRestriction(session.branch_id, 'confirm')
}
```

### Modification to Existing updateLine / bulkUpdateLines

```typescript
// In updateLine and bulkUpdateLines methods, change:
// if (session.status !== 'DRAFT') throw new OpnameNotDraftError(session.status)
// To:
if (session.status !== 'DRAFT' && session.status !== 'REOPENED') {
  throw new OpnameNotDraftError(session.status)
}

// Skip time and expiry validation when REOPENED:
if (session.status !== 'REOPENED') {
  if (this.isSessionExpired(session)) {
    throw new OpnameSessionExpiredError(session.closing_date)
  }
  await this.validateTimeRestriction(session.branch_id, 'edit')
}
```

## Repository Design

### `daily-stock-opname-reopen.repository.ts`

```typescript
import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  OpnameReopenRequest,
  OpnameReopenRequestWithRelations,
} from './daily-stock-opname-reopen.types'

export class DailyStockOpnameReopenRepository {

  async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async insertRequest(
    client: PoolClient,
    data: { closing_id: string; requested_by: string; reason: string },
  ): Promise<OpnameReopenRequest> {
    const { rows } = await client.query(
      `INSERT INTO opname_reopen_requests (closing_id, requested_by, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.closing_id, data.requested_by, data.reason],
    )
    return rows[0]
  }

  async findPendingByClosingId(closingId: string): Promise<OpnameReopenRequest | null> {
    const { rows } = await pool.query(
      `SELECT * FROM opname_reopen_requests
       WHERE closing_id = $1 AND status = 'PENDING'
       LIMIT 1`,
      [closingId],
    )
    return rows[0] ?? null
  }

  async findById(requestId: string): Promise<OpnameReopenRequest | null> {
    const { rows } = await pool.query(
      `SELECT * FROM opname_reopen_requests WHERE id = $1`,
      [requestId],
    )
    return rows[0] ?? null
  }

  async findByIdWithRelations(requestId: string): Promise<OpnameReopenRequestWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT
        orr.*,
        req_emp.full_name AS requested_by_name,
        resp_emp.full_name AS responded_by_name,
        dcc.closing_date,
        b.branch_name
      FROM opname_reopen_requests orr
      JOIN daily_closing_counts dcc ON dcc.id = orr.closing_id
      JOIN branches b ON b.id = dcc.branch_id
      LEFT JOIN employees req_emp ON req_emp.user_id = orr.requested_by
      LEFT JOIN employees resp_emp ON resp_emp.user_id = orr.responded_by
      WHERE orr.id = $1`,
      [requestId],
    )
    return rows[0] ?? null
  }

  async findByClosingId(closingId: string): Promise<OpnameReopenRequestWithRelations[]> {
    const { rows } = await pool.query(
      `SELECT
        orr.*,
        req_emp.full_name AS requested_by_name,
        resp_emp.full_name AS responded_by_name,
        dcc.closing_date,
        b.branch_name
      FROM opname_reopen_requests orr
      JOIN daily_closing_counts dcc ON dcc.id = orr.closing_id
      JOIN branches b ON b.id = dcc.branch_id
      LEFT JOIN employees req_emp ON req_emp.user_id = orr.requested_by
      LEFT JOIN employees resp_emp ON resp_emp.user_id = orr.responded_by
      WHERE orr.closing_id = $1
      ORDER BY orr.requested_at DESC`,
      [closingId],
    )
    return rows
  }

  async updateStatus(
    client: PoolClient,
    requestId: string,
    data: {
      status: 'APPROVED' | 'REJECTED'
      responded_by: string
      responded_at: string
      response_note: string | null
    },
  ): Promise<void> {
    await client.query(
      `UPDATE opname_reopen_requests
       SET status = $1, responded_by = $2, responded_at = $3, response_note = $4, updated_at = now()
       WHERE id = $5`,
      [data.status, data.responded_by, data.responded_at, data.response_note, requestId],
    )
  }

  /**
   * Get all stock movements created by the original confirm flow for this session.
   * These are the movements that need to be reversed on reopen.
   */
  async getMovementsByClosingId(
    client: PoolClient,
    closingId: string,
  ): Promise<{ product_id: string; movement_type: string; qty: number; cost_per_unit: number }[]> {
    const { rows } = await client.query(
      `SELECT product_id, movement_type, qty, cost_per_unit
       FROM stock_movements
       WHERE reference_type = 'daily_closing_count'
         AND reference_id = $1
         AND movement_type IN ('OUT_WASTE', 'IN_ADJUSTMENT')`,
      [closingId],
    )
    return rows
  }
}

export const reopenRepository = new DailyStockOpnameReopenRepository()
```

## Validation Schema

```typescript
// In daily-stock-opname.schema.ts (additions)
import { z } from 'zod'

export const createReopenRequestSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1, 'Alasan wajib diisi'),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const respondReopenRequestSchema = z.object({
  body: z.object({
    response_note: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const getReopenRequestsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})
```

## Notification Event Registration

```typescript
// Add to NOTIFICATION_EVENT_KEYS
OPNAME_REOPEN_REQUESTED: 'opname.reopen_requested',

// Add to NOTIFICATION_EVENT_CATALOG
{
  event_key: NOTIFICATION_EVENT_KEYS.OPNAME_REOPEN_REQUESTED,
  label: 'Permintaan edit ulang opname',
  description: 'PIC mengajukan permintaan edit ulang opname yang sudah dikonfirmasi',
  category: 'inventory',
  default_type: 'approval_required',
  default_title_template: 'Permintaan Edit Ulang Opname',
  default_message_template: '{{pic_name}} meminta izin edit ulang opname {{branch_name}} tanggal {{closing_date}}. Alasan: {{reason}}',
  default_redirect_url_template: '/inventory/daily-stock-opname/{{session_id}}',
}
```

## Frontend Components

### ReopenRequestButton

Displayed on the session detail page when:
- Session status is CONFIRMED or FLAGGED
- Current user is the PIC of the session
- No PENDING reopen request exists

```typescript
interface ReopenRequestButtonProps {
  sessionId: string
  sessionStatus: OpnameStatus
  picUserId: string
  hasPendingRequest: boolean
}
```

### ReopenApprovalPanel

Displayed on the session detail page when:
- A PENDING reopen request exists for the session
- Current user has the `approve` permission on `daily_stock_opname`

Shows: requester name, reason, timestamp, approve/reject buttons with optional note field.

### Status Badge Extension

```typescript
// Extend existing status display mapping
const STATUS_LABELS: Record<OpnameStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Dikonfirmasi',
  FLAGGED: 'Ada Selisih',
  REOPENED: 'Sedang Diedit Ulang',
}

const STATUS_COLORS: Record<OpnameStatus, string> = {
  DRAFT: 'gray',
  CONFIRMED: 'green',
  FLAGGED: 'amber',
  REOPENED: 'blue',
}
```

## Error Handling

```typescript
// New error classes in daily-stock-opname.errors.ts

export class OpnameNotEligibleForReopenError extends BusinessRuleError {
  constructor(status: string) {
    super(`Sesi opname dengan status "${status}" tidak dapat diminta edit ulang. Hanya sesi CONFIRMED atau FLAGGED yang eligible.`)
  }
}

export class OpnameReopenPendingExistsError extends BusinessRuleError {
  constructor() {
    super('Sudah ada permintaan edit ulang yang masih menunggu approval untuk sesi ini.')
  }
}

export class OpnameReopenAlreadyRespondedError extends BusinessRuleError {
  constructor() {
    super('Permintaan edit ulang ini sudah direspon sebelumnya.')
  }
}

export class OpnameReopenNotFoundError extends BusinessRuleError {
  constructor(id: string) {
    super(`Permintaan edit ulang dengan ID "${id}" tidak ditemukan.`)
  }
}
```

## Duplicate Session Prevention for REOPENED Status

The existing `findByBranchDateAndPosition` query already prevents creating new sessions for the same branch + date + position combination. Since REOPENED sessions retain their row in `daily_closing_counts` with `is_deleted = false`, the existing duplicate check naturally blocks new session creation.

No modification needed — the existing logic handles this.

## Sequence Diagrams

### Reopen Request Flow

```
PIC              API              ReopenService       Repository       NotificationDispatcher
 │                │                    │                  │                    │
 │─POST /reopen──▶│                    │                  │                    │
 │   {reason}     │──createRequest()──▶│                  │                    │
 │                │                    │──validate()──────▶│                    │
 │                │                    │  (status check)   │                    │
 │                │                    │  (pending check)  │                    │
 │                │                    │──insertRequest()─▶│                    │
 │                │                    │◀─────────────────│                    │
 │                │                    │──dispatch()──────────────────────────▶│
 │                │                    │  (OPNAME_REOPEN_REQUESTED)            │
 │                │◀───────────────────│                  │                    │
 │◀──201 Created──│                    │                  │                    │
```

### Approval Flow (with stock reversal)

```
Approver         API              ReopenService       Repository    StockRepo   ClassificationRepo
 │                │                    │                  │             │              │
 │─POST /approve─▶│                    │                  │             │              │
 │                │──approveRequest()─▶│                  │             │              │
 │                │                    │──BEGIN TX────────▶│             │              │
 │                │                    │──updateStatus()──▶│             │              │
 │                │                    │──getMovements()──▶│             │              │
 │                │                    │◀─[movements]─────│             │              │
 │                │                    │                  │             │              │
 │                │                    │  for each movement:            │              │
 │                │                    │──createMovement()─────────────▶│              │
 │                │                    │  (IN_REVERSAL or OUT_REVERSAL) │              │
 │                │                    │──upsertBalance()──────────────▶│              │
 │                │                    │                  │             │              │
 │                │                    │──deleteByClosingId()───────────────────────────▶│
 │                │                    │──updateHeaderStatus(REOPENED)──▶│             │
 │                │                    │──COMMIT──────────▶│             │              │
 │                │                    │                  │             │              │
 │                │                    │──AuditService.log()            │              │
 │                │◀───────────────────│                  │             │              │
 │◀──200 OK──────│                    │                  │             │              │
```

## Testing Strategy

### Unit Tests (Example-Based)
- Notification dispatch with correct event key, variables, and recipient IDs (mock-based)
- Notification message includes branch_name, closing_date, pic_name
- No notification dispatched on rejection
- confirmed_by and confirmed_at updated after re-confirmation
- Status label mapping returns "Sedang Diedit Ulang" for REOPENED

### Integration Tests
- AuditService.log called with correct entity_type and entity_id on create/approve/reject
- Full approval flow: request creation → approval → session status + movements + classifications
- Full re-confirmation flow after reopen

### Property-Based Tests
- See Correctness Properties below — each property to be tested with 100+ random inputs

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Reopen request creation guard — only eligible statuses

*For any* session with a status that is NOT `CONFIRMED` or `FLAGGED`, attempting to create a reopen request SHALL always result in a rejection error, regardless of the reason provided or the user making the request.

**Validates: Requirements 1.2**

### Property 2: At-most-one PENDING request invariant

*For any* session that already has a reopen request with status `PENDING`, attempting to create another reopen request for the same session SHALL always result in a rejection error.

**Validates: Requirements 1.3**

### Property 3: Empty reason rejection

*For any* string composed entirely of whitespace characters (including the empty string), attempting to create a reopen request with that string as the reason SHALL be rejected.

**Validates: Requirements 1.4**

### Property 4: Approval transitions session to REOPENED

*For any* PENDING reopen request that is approved by a user with the `approve` permission, the associated session's status SHALL be `REOPENED` after the approval completes.

**Validates: Requirements 3.1, 3.2**

### Property 5: Non-PENDING requests cannot be responded to

*For any* reopen request with status `APPROVED` or `REJECTED`, attempting to approve or reject it SHALL always result in an error.

**Validates: Requirements 3.3**

### Property 6: Rejection preserves session status

*For any* PENDING reopen request that is rejected, the associated session's status SHALL remain unchanged (still `CONFIRMED` or `FLAGGED` as it was before).

**Validates: Requirements 4.1, 4.2**

### Property 7: Rejection unblocks new request creation

*For any* session whose most recent reopen request has status `REJECTED`, creating a new reopen request for that session SHALL succeed (assuming valid reason and eligible session status).

**Validates: Requirements 4.3**

### Property 8: Counter-movement correctness on reopen

*For any* confirmed session with N stock movements (of types OUT_WASTE or IN_ADJUSTMENT), when the session is reopened, the system SHALL create exactly N counter-movements where:
- Each OUT_WASTE movement produces an IN_REVERSAL with the same qty and cost_per_unit
- Each IN_ADJUSTMENT movement produces an OUT_REVERSAL with the same qty and cost_per_unit
- All counter-movements have reference_type = 'daily_closing_count' and reference_id = session ID

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 9: Stock balance net-zero after reversal

*For any* product affected by the reopen operation, the stock balance change caused by the counter-movements SHALL exactly negate the stock balance change caused by the original movements. Specifically: if the original created an OUT_WASTE of qty Q, the reversal adds Q back; if the original created an IN_ADJUSTMENT of qty Q, the reversal subtracts Q.

**Validates: Requirements 5.5**

### Property 10: Classification cleanup on reopen

*For any* session that transitions to REOPENED status, all variance classification entries for that session SHALL be deleted, resulting in waste_total = 0, shortage_total = 0, and entry_count = 0.

**Validates: Requirements 6.1, 6.2**

### Property 11: REOPENED sessions bypass time restrictions

*For any* session with status `REOPENED`, editing lines (updating actual_qty) SHALL succeed regardless of the current time relative to closing_time, and regardless of whether the session's closing_date is in the past.

**Validates: Requirements 7.1, 7.3**

### Property 12: Reopen preserves actual_qty values

*For any* session that transitions from CONFIRMED/FLAGGED to REOPENED, all line actual_qty values SHALL remain equal to their pre-reopen values (not reset to NULL).

**Validates: Requirements 7.2**

### Property 13: DPO blocking applies to REOPENED re-confirmation

*For any* REOPENED session where an active Daily Prep Order exists for the same branch and date, attempting to confirm the session SHALL be rejected with the DPO blocking error.

**Validates: Requirements 7.4**

### Property 14: Re-confirmation produces correct movements

*For any* REOPENED session with updated actual_qty values, confirming the session SHALL create OUT_WASTE movements for lines where actual_qty < expected_qty, and IN_ADJUSTMENT movements for lines where actual_qty > expected_qty, with quantities equal to the absolute variance.

**Validates: Requirements 8.1**

### Property 15: Re-confirmation status determination

*For any* re-confirmed session, the final status SHALL be FLAGGED if any line with expected_qty > 0 has |variance_pct| exceeding the configured threshold, and CONFIRMED otherwise.

**Validates: Requirements 8.2**

### Property 16: Re-confirmation cost total correctness

*For any* re-confirmed session, total_actual_cost SHALL equal the sum of (actual_qty × cost_per_unit) across all lines, and total_variance_cost SHALL equal the sum of |variance_cost| across all lines.

**Validates: Requirements 8.3**

### Property 17: REOPENED status blocks duplicate session creation

*For any* session with status REOPENED, attempting to create a new opname session for the same branch, warehouse, position, and closing_date SHALL be rejected.

**Validates: Requirements 10.3**
