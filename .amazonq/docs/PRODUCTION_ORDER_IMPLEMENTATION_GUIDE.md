# Production Order Implementation Guide

> **Tanggal**: 2 Juni 2025  
> **Topik**: Complete workflow untuk Food Production WIP, Production Orders, dan Journal Integration  
> **Audience**: Engineers, QA, Business Analysts  
> **Status**: ✅ Reference Documentation (Backend 90%, Frontend 70%, Stock Integration 0%)

---

## Daftar Isi

1. [Overview](#overview)
2. [Architecture & Relationships](#architecture--relationships)
3. [Question 1: WIP Position Filter](#question-1-wip-position-filter-saat-create-production-order)
4. [Question 2: Create Order Flow](#question-2-ketika-button-buat-order-ditekan)
5. [Question 3: Planned vs Actual vs Waste](#question-3-planned-vs-actual-vs-waste-bagaimana-bekerja)
6. [Question 4: Stock & Inventory](#question-4-bahan-terpakai-dan-hasil-produksi)
7. [Question 5: Journal & Undo](#question-5-journal-dan-undo-flow)
8. [Implementation Gaps](#implementation-gaps)
9. [Next Steps](#next-steps)

---

## Overview

**Suryamas Production Order** adalah sistem untuk mencatat produksi harian recipe (WIP - Work In Progress) per cabang/branch.

**Key Principles:**
- ✅ **Multi-WIP per order**: 1 production order bisa berisi 10 WIP sekaligus (Chicken Katsu, Fried Rice, dll)
- ✅ **Planned vs Actual tracking**: Capture rencana (planned) vs realisasi (actual) + waste per bahan
- ✅ **Cost snapshot**: Semua cost di-freeze saat create untuk consistency historis
- ✅ **Position-based access**: Hanya chef/positions tertentu bisa produce WIP spesifik
- ✅ **Automatic journal**: Generate GL entries otomatis untuk akuntansi (Bahan Baku → WIP → COGS)
- ⚠️ **Partial stock integration**: Journal saja, stock movement belum full auto
- ✅ **Audit trail**: Void + reverse journal untuk undo

**Status Workflow:**

```
DRAFT → COMPLETED → JOURNALED
  ↓         ↓           ↓
VOID     VOID       VOID
(soft)   (soft)     (reverse journal)
```

---

## Architecture & Relationships

### Database Schema Diagram

```
┌─────────────────────────────────────┐
│ wip_items (Master Recipe)           │
├─────────────────────────────────────┤
│ id, company_id, wip_code            │
│ wip_name, uom, yield_qty            │
│ estimated_cost, cost_per_unit       │
│ is_active, deleted_at               │
└────────────────────┬────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   [ingredients] [positions] [no direct FK]
                              
┌─────────────────────────────────────┐
│ wip_position_access                 │
├─────────────────────────────────────┤
│ wip_id, position_id                 │
│ (Restricts WIP to certain positions)│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ production_orders (Header)          │
├─────────────────────────────────────┤
│ id, company_id, branch_id           │
│ order_number (unique)               │
│ production_date                     │
│ status: DRAFT|COMPLETED|JOURNALED   │
│ total_material_cost, total_waste    │
│ journal_id (FK to journals)         │
│ created_by, completed_by, voided_by │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌──────────────────┐ ┌──────────────────────────┐
│ order_lines (10) │ │ order_materials (50+)    │
├──────────────────┤ ├──────────────────────────┤
│ production_id    │ │ production_order_id      │
│ wip_id           │ │ production_line_id       │
│ planned_batch    │ │ product_id               │
│ actual_batch     │ │ planned_qty              │
│ yield_per_batch  │ │ actual_qty (NULL→)       │
│ cost_per_batch   │ │ waste_qty (NULL→)        │
│ (snapshots)      │ │ cost_per_unit (snapshot) │
└──────────────────┘ │ cost_source              │
                     └──────────────────────────┘
```

### Key Tables & Fields

#### `production_orders`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `order_number` | VARCHAR(30) UNIQUE | Format: `PRD-{BRANCH_CODE}-{YYYYMMDD}-{SEQ}` |
| `company_id` | UUID FK | Multi-company |
| `branch_id` | UUID FK | Which branch produced |
| `production_date` | DATE | When produced (not timestamp) |
| `status` | ENUM | DRAFT, COMPLETED, JOURNALED, VOID |
| `total_material_cost` | NUMERIC(20,4) | Sum of material.total_cost |
| `total_waste_cost` | NUMERIC(20,4) | Sum of waste_qty × cost_per_unit |
| `notes` | TEXT | User notes |
| `completed_by` | UUID | Who completed it |
| `completed_at` | TIMESTAMPTZ | When completed |
| `voided_by` | UUID | Who voided |
| `voided_at` | TIMESTAMPTZ | When voided |
| `void_reason` | TEXT | Why voided |
| `journal_id` | UUID FK | Link to journals table |
| `is_deleted` | BOOLEAN | Soft delete (DRAFT only) |
| `created_at, updated_at` | TIMESTAMPTZ | Audit |
| `created_by, updated_by` | UUID | Audit |

#### `production_order_lines`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `production_order_id` | UUID FK | Parent |
| `wip_id` | UUID FK | Which WIP produced |
| `wip_name, wip_code` | VARCHAR | **SNAPSHOT** (can change in master) |
| `yield_per_batch` | NUMERIC | **SNAPSHOT** from wip_items.yield_qty |
| `uom` | VARCHAR | Unit (pcs, kg, L, etc) |
| `cost_per_batch` | NUMERIC | **SNAPSHOT** from wip_items.estimated_cost |
| `planned_batch_qty` | NUMERIC | User input at create |
| `actual_batch_qty` | NUMERIC | User input at complete (NULL until complete) |
| `total_yield` | NUMERIC | **APP-CALCULATED** = actual_batch_qty × yield_per_batch |
| `total_cost` | NUMERIC | **APP-CALCULATED** = actual_batch_qty × cost_per_batch |
| `sort_order` | INT | Ordering |

#### `production_order_materials`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `production_order_id` | UUID FK | Parent |
| `production_line_id` | UUID FK | Which line (for grouping) |
| `product_id` | UUID FK | Which raw material |
| `product_name, product_code` | VARCHAR | **SNAPSHOT** |
| `planned_qty` | NUMERIC | ingredient.qty × line.planned_batch_qty |
| `actual_qty` | NUMERIC | User input at complete (NULL until complete) |
| `uom` | VARCHAR | Unit |
| `cost_per_unit` | NUMERIC | **SNAPSHOT** (from wip_ingredients or product.average_cost) |
| `cost_source` | ENUM | 'wip_ingredient' \| 'average_cost' (fallback) |
| `waste_qty` | NUMERIC | User input at complete |
| `waste_reason` | TEXT | Why waste (pecah, hangus, etc) |
| `total_cost` | NUMERIC | **APP-CALCULATED** = actual_qty × cost_per_unit |
| `sort_order` | INT | Ordering |
| `created_at` | TIMESTAMPTZ | For tracking |

---

## Question 1: WIP Position Filter Saat Create Production Order

### Current Implementation Status

✅ **Already implemented** - Uses `filter_by_position=true` query parameter

### How It Works

#### Frontend: ProductionOrderForm.tsx

```typescript
// Line 34-36
const wipItems = useWipItems(
  { limit: 500, filter_by_position: true, branch_id: branchId || undefined },
  { enabled: !!branchId },
)
```

When user selects a branch, the dropdown automatically filters to show only WIPs accessible to their position.

#### Backend: Position-Based Access Control

**3-Layer Permission Check:**

```
Layer 1: Company Access
  ├─ Is user in this company?
  └─ Fail → empty list

Layer 2: Branch Access  
  ├─ Does user have branch assignment?
  └─ Fail → empty list

Layer 3: Position Access (Position-Restricted WIPs)
  ├─ Does user have matching position?
  ├─ Or is position unrestricted?
  └─ Or does user have can_access_all_wip flag?
```

**Query Flow:**

```typescript
// wip.controller.ts line 45-50
if (req.query.filter_by_position === 'true' && req.user?.id) {
  const access = branchId
    ? await resolveUserWipAccessForBranch(req.user.id, branchId)
    : await resolveUserWipAccess(req.user.id)
  positionIds = access.positionIds
  canAccessAll = access.canAccessAll
}
```

#### Position Resolution: wip-access.util.ts

```typescript
export async function resolveUserWipAccessForBranch(
  userId: string,
  branchId: string
): Promise<UserWipAccess> {
  // Get positions from 2 sources:
  
  // 1. Global employee_positions (across all branches)
  // 2. Per-branch position in employee_branches for THIS branch
  
  return {
    positionIds: [...global positions, ...branch positions],
    canAccessAll: user.can_access_all_wip
  }
}
```

**SQL Behind It:**

```sql
SELECT DISTINCT p.id AS position_id, p.can_access_all_wip
FROM employees e
LEFT JOIN employee_positions ep ON ep.employee_id = e.id
LEFT JOIN positions p ON p.id = ep.position_id
WHERE e.user_id = $1

UNION

SELECT DISTINCT p.id AS position_id, p.can_access_all_wip
FROM employees e
JOIN employee_branches eb ON eb.employee_id = e.id 
  AND eb.branch_id = $2
  AND eb.status = 'active'
JOIN positions p ON p.id = eb.position_id
WHERE e.user_id = $1
```

#### WIP Filtering Logic

**Rules:**

```
IF no wip_position_access records for this WIP:
  ├─ Everyone can access ✓
  
ELSE IF user has can_access_all_wip position:
  ├─ Always can access ✓
  
ELSE IF any of user's positions in wip_position_access:
  ├─ Can access ✓
  
ELSE:
  └─ Cannot access ✗
```

**Example Scenario: 2 Juni 2025, Cabang Condet**

```
User: Chef (position_id: pos-001)
User's positions:
  - Chef (from employee_positions)
  - Kitchen Staff (from employee_branches for Condet)

Master WIP:
  ┌────────────────┬──────────────────────┬─────────┐
  │ WIP Name       │ Position Restrictions│ Access? │
  ├────────────────┼──────────────────────┼─────────┤
  │ Chicken Katsu  │ Chef, Sous Chef      │ ✅ YES  │
  │ Fried Rice     │ Chef                 │ ✅ YES  │
  │ Sushi          │ Head Chef only       │ ❌ NO   │
  │ Sauce          │ (unrestricted)       │ ✅ YES  │
  │ Nasi Kuning    │ (unrestricted)       │ ✅ YES  │
  └────────────────┴──────────────────────┴─────────┘

Dropdown shows: Chicken Katsu, Fried Rice, Sauce, Nasi Kuning
Hidden: Sushi
```

### Implementation Details

**File: `/backend/src/modules/food-production/wip/wip-access.util.ts`**

Key function: `filterAccessibleWipIds(userId: string, wipIds: string[])`

```typescript
export async function filterAccessibleWipIds(
  userId: string,
  wipIds: string[]
): Promise<string[]> {
  if (wipIds.length === 0) return []

  const access = await resolveUserWipAccess(userId)
  if (access.canAccessAll) return wipIds

  // Get all restrictions for the requested WIPs
  const restrictions = await pool.query(
    `SELECT wip_id, position_id 
     FROM wip_position_access 
     WHERE wip_id = ANY($1::uuid[])`,
    [wipIds]
  )

  const restrictionMap = new Map<string, string[]>()
  for (const r of restrictions) {
    restrictionMap.get(r.wip_id)?.push(r.position_id)
  }

  const userPositionSet = new Set(access.positionIds)

  return wipIds.filter(wipId => {
    const required = restrictionMap.get(wipId)
    if (!required) return true // No restriction
    return required.some(pid => userPositionSet.has(pid))
  })
}
```

---

## Question 2: Ketika Button "Buat Order" Ditekan

### Complete Step-by-Step Flow

#### 1. Frontend Validation

```typescript
// ProductionOrderForm.tsx - handleSubmit
const handleSubmit = async () => {
  // Check 1: Branch selected?
  if (!branchId) { 
    toast.warning('Pilih cabang')
    return 
  }

  // Check 2: At least 1 valid WIP?
  const validLines = lines.filter(l => l.wip_id && l.planned_batch_qty > 0)
  if (validLines.length === 0) { 
    toast.warning('Tambah minimal 1 WIP')
    return 
  }

  // Check 3: Call API
  const order = await createOrder.mutateAsync({
    branch_id: branchId,
    production_date: productionDate,
    notes: notes || undefined,
    lines: validLines, // [{ wip_id, planned_batch_qty }, ...]
  })

  // Redirect
  navigate(`/food-production/production/${order.id}`)
}
```

#### 2. API Call → Backend

```typescript
// frontend/src/features/food-production/api/food-production.api.ts
export const useCreateProductionOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateProductionOrderDto) => {
      const { data } = await api.post('/production-orders', body)
      return data.data as ProductionOrderWithDetails
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['food-production', 'production-orders'] })
    },
  })
}
```

#### 3. Backend: Validation Layer

```typescript
// backend/src/modules/food-production/production-orders/production-orders.service.ts

async create(dto: CreateProductionOrderDto, accessibleCompanyIds: string[]) {
  // Validation 1: User identified?
  if (!dto.created_by) {
    throw new BusinessRuleError('User tidak teridentifikasi')
  }

  // Validation 2: Branch exists & get company?
  const companyId = await getCompanyIdForBranch(dto.branch_id)
  if (!companyId) {
    throw new BusinessRuleError('Cabang tidak ditemukan')
  }

  // Validation 3: User has company access?
  requireCompanyAccess(companyId, accessibleCompanyIds)

  // Validation 4: User has branch access?
  const hasAccess = await productionOrdersRepository
    .userHasBranchAccess(dto.created_by, dto.branch_id)
  if (!hasAccess) {
    throw new BusinessRuleError('Anda tidak memiliki akses ke cabang ini')
  }

  // Validation 5: User has position access to each WIP?
  const requestedWipIds = dto.lines.map(l => l.wip_id)
  const allowedWipIds = await filterAccessibleWipIds(dto.created_by, requestedWipIds)
  const blockedWips = requestedWipIds.filter(id => !allowedWipIds.includes(id))
  if (blockedWips.length > 0) {
    throw new BusinessRuleError(
      'Anda tidak memiliki akses posisi untuk memproduksi beberapa WIP'
    )
  }

  // Validation passed, proceed to creation...
}
```

#### 4. Backend: Transaction Begin

```typescript
async create(dto: CreateProductionOrderDto, accessibleCompanyIds: string[]) {
  const orderId = await productionOrdersRepository.withTransaction(async (client) => {
    // All DB operations use same transaction client
    // If any fails, entire transaction rolls back
    
    // Step 1: Generate order number
    // Step 2: Insert header
    // Step 3: Insert lines + materials
  })
}
```

#### 5. Generate Order Number

```typescript
// Format: PRD-{BRANCH_CODE}-{YYYYMMDD}-{SEQ}
// Example: PRD-CDT-20250602-001

private async generateOrderNumber(
  client: PoolClient,
  companyId: string,
  branchId: string,
  productionDate: string
): Promise<string> {
  // Get branch code
  const branch = await branchRepository.findById(branchId)
  const branchCode = branch.branch_code // "CDT"

  // Query last sequence for this date
  const { rows } = await client.query(`
    SELECT COUNT(*)::int as seq
    FROM production_orders
    WHERE branch_id = $1 
      AND production_date = $2
      AND deleted_at IS NULL
  `, [branchId, productionDate])

  const nextSeq = (rows[0]?.seq || 0) + 1
  const dateStr = productionDate.replace(/-/g, '') // "20250602"
  return `PRD-${branchCode}-${dateStr}-${String(nextSeq).padStart(3, '0')}`
}
```

#### 6. Insert Production Order Header

```typescript
// production-orders.repository.ts
async insertHeader(
  client: PoolClient,
  data: {
    company_id: string
    branch_id: string
    order_number: string
    production_date: string
    notes?: string
    created_by: string
  }
): Promise<string> {
  const { rows } = await client.query(`
    INSERT INTO production_orders (
      company_id, branch_id, order_number, production_date,
      notes, status, created_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, now())
    RETURNING id
  `, [
    data.company_id,
    data.branch_id,
    data.order_number,
    data.production_date,
    data.notes || null,
    data.created_by,
  ])
  
  return rows[0].id
}
```

#### 7. For Each WIP Line

```typescript
// production-orders.service.ts - inside withTransaction
for (let i = 0; i < resolvedDto.lines.length; i++) {
  const lineDto = resolvedDto.lines[i]
  
  // 7a. Load WIP from database (with ingredients)
  const wip = await wipRepository.findByIdWithIngredientsAccessible(
    lineDto.wip_id,
    accessibleCompanyIds
  )
  
  if (!wip) {
    throw new ProductionOrderWipNotFoundError()
  }

  // 7b. Create line record (snapshot WIP data)
  const line = await productionOrdersRepository.insertLine(client, {
    production_order_id: header.id,
    wip_id: wip.id,
    wip_name: wip.wip_name,           // ← SNAPSHOT
    wip_code: wip.wip_code,           // ← SNAPSHOT
    yield_per_batch: wip.yield_qty,   // ← SNAPSHOT
    uom: wip.uom,                     // ← SNAPSHOT
    cost_per_batch: wip.estimated_cost, // ← SNAPSHOT
    planned_batch_qty: lineDto.planned_batch_qty,
    sort_order: i,
  })

  // 7c. For each ingredient in this WIP
  for (let j = 0; j < wip.ingredients.length; j++) {
    const ingredient = wip.ingredients[j]
    
    // Calculate planned_qty
    const plannedQty = ingredient.qty * lineDto.planned_batch_qty
    
    // Get cost_per_unit (snapshot)
    const costPerUnit = ingredient.cost_per_unit > 0
      ? ingredient.cost_per_unit
      : (await productRepository.getAverageCost(ingredient.product_id))
    
    // Create material record
    await productionOrdersRepository.insertMaterial(client, {
      production_order_id: header.id,
      production_line_id: line.id,
      product_id: ingredient.product_id,
      product_name: ingredient.product_name,      // ← SNAPSHOT
      product_code: ingredient.product_code,      // ← SNAPSHOT
      planned_qty: plannedQty,
      uom: ingredient.uom,
      cost_per_unit: costPerUnit,                // ← SNAPSHOT
      cost_source: ingredient.cost_per_unit > 0 
        ? 'wip_ingredient' 
        : 'average_cost',
      waste_qty: 0,
      sort_order: j,
    })
  }
}
```

#### 8. Transaction Commit

```typescript
// If all steps succeed:
const orderId = await productionOrdersRepository.withTransaction(async (client) => {
  // ... all inserts done
  // Automatically commit on return
  return header.id
})
```

#### 9. Load Full Order & Return

```typescript
// Get newly created order with all details
const order = await productionOrdersRepository.findByIdAccessible(orderId, companyIds)
return order
```

#### 10. Frontend Redirect

```typescript
// ProductionOrderForm.tsx
toast.success('Production order dibuat')
navigate(`/food-production/production/${order.id}`) // Go to detail page
```

### Database State After Create

**Example: 10 Chicken Katsu + 2 Sauce**

```sql
-- production_orders
INSERT INTO production_orders VALUES (
  id: 'order-001',
  order_number: 'PRD-CDT-20250602-001',
  company_id: 'cmp-001',
  branch_id: 'br-condet',
  production_date: '2025-06-02',
  status: 'DRAFT',
  total_material_cost: 0,      -- Updated at COMPLETE
  total_waste_cost: 0,         -- Updated at COMPLETE
  notes: NULL,
  created_by: 'chef-123',
  created_at: '2025-06-02 08:30:00+07'
);

-- production_order_lines (2 WIP lines)
INSERT INTO production_order_lines VALUES (
  id: 'line-001',
  production_order_id: 'order-001',
  wip_id: 'wip-katsu',
  wip_name: 'Chicken Katsu',
  wip_code: 'KATSU-001',
  yield_per_batch: 5,
  uom: 'pcs',
  cost_per_batch: 45000,
  planned_batch_qty: 10,
  actual_batch_qty: NULL,      -- Filled at COMPLETE
  total_yield: NULL,           -- Calculated at COMPLETE
  total_cost: NULL,            -- Calculated at COMPLETE
  sort_order: 0
);

INSERT INTO production_order_lines VALUES (
  id: 'line-002',
  production_order_id: 'order-001',
  wip_id: 'wip-sauce',
  wip_name: 'Katsu Sauce',
  ...
  planned_batch_qty: 2,
  sort_order: 1
);

-- production_order_materials (ingredients for Katsu line 1)
-- Katsu has 5 ingredients: Ayam, Tepung, Telur, Minyak, Garam

INSERT INTO production_order_materials VALUES (
  id: 'mat-001',
  production_order_id: 'order-001',
  production_line_id: 'line-001',
  product_id: 'prod-ayam',
  product_name: 'Ayam Fillet',
  product_code: 'AYAM-001',
  planned_qty: 10.0,           -- 1kg × 10 batch
  actual_qty: NULL,            -- Filled at COMPLETE
  uom: 'kg',
  cost_per_unit: 50000,        -- Per kg
  cost_source: 'wip_ingredient',
  waste_qty: 0,
  waste_reason: NULL,
  sort_order: 0
);

INSERT INTO production_order_materials VALUES (
  id: 'mat-002',
  product_name: 'Tepung Roti',
  planned_qty: 2.0,            -- 0.2kg × 10 batch
  cost_per_unit: 10000,
  ...
);

-- ... etc for Telur, Minyak, Garam, then Sauce ingredients
```

### API Response Structure

```json
{
  "success": true,
  "data": {
    "id": "order-001",
    "order_number": "PRD-CDT-20250602-001",
    "company_id": "cmp-001",
    "branch_id": "br-condet",
    "branch_name": "Cabang Condet",
    "production_date": "2025-06-02",
    "status": "DRAFT",
    "total_material_cost": 0,
    "total_waste_cost": 0,
    "total_estimated_cost": 495000,
    "notes": null,
    "created_by": "chef-123",
    "created_by_name": "Chef Budi",
    "created_at": "2025-06-02T08:30:00+07:00",
    "updated_at": "2025-06-02T08:30:00+07:00",
    "lines": [
      {
        "id": "line-001",
        "wip_id": "wip-katsu",
        "wip_code": "KATSU-001",
        "wip_name": "Chicken Katsu",
        "planned_batch_qty": 10,
        "actual_batch_qty": null,
        "yield_per_batch": 5,
        "uom": "pcs",
        "total_yield": null,
        "cost_per_batch": 45000,
        "total_cost": null,
        "sort_order": 0,
        "materials": [
          {
            "id": "mat-001",
            "product_id": "prod-ayam",
            "product_code": "AYAM-001",
            "product_name": "Ayam Fillet",
            "planned_qty": 10.0,
            "actual_qty": null,
            "uom": "kg",
            "cost_per_unit": 50000,
            "cost_source": "wip_ingredient",
            "waste_qty": 0,
            "waste_reason": null,
            "total_cost": null,
            "sort_order": 0
          },
          // ... other materials
        ]
      },
      // ... line 2 (Sauce)
    ]
  },
  "message": "Production order created"
}
```

---

## Question 3: Planned vs Actual vs Waste - Bagaimana Bekerja

### Conceptual Timeline

```
┌─────────────────────────────────────────────────┐
│ PHASE 1: CREATE (Status: DRAFT)                 │
└─────────────────────────────────────────────────┘

Planned Data:
  ├─ lines.planned_batch_qty = 10 batches
  ├─ materials.planned_qty = ingredient × batches
  ├─ cost_per_unit SNAPSHOT (frozen)
  └─ estimated total cost calculated

Database:
  ├─ actual_batch_qty: NULL
  ├─ actual_qty: NULL
  ├─ waste_qty: 0
  └─ total_cost: NULL

User Action: Can edit planned_batch_qty before submitting
             (No UI for this currently, locked on create)

┌─────────────────────────────────────────────────┐
│ PHASE 2: COMPLETION (Status: COMPLETED)         │
└─────────────────────────────────────────────────┘

User Input (actual results):
  ├─ Per line: actual_batch_qty (how many batches really made)
  └─ Per material:
      ├─ actual_qty (how much really used)
      ├─ waste_qty (how much was wasted)
      └─ waste_reason (optional)

Validation:
  ├─ waste_qty ≤ actual_qty (CHECK constraint)
  ├─ actual_qty can be > or < planned_qty
  └─ Validated in both app + DB

System Calculates:
  ├─ total_yield = actual_batch_qty × yield_per_batch
  ├─ Per material: total_cost = actual_qty × cost_per_unit
  ├─ Per material: waste_cost = waste_qty × cost_per_unit
  └─ Header totals:
      ├─ total_material_cost = SUM(all material.total_cost)
      └─ total_waste_cost = SUM(all waste_cost)

Database Update:
  ├─ actual_batch_qty ← filled
  ├─ actual_qty ← filled
  ├─ waste_qty ← filled
  ├─ total_cost ← calculated
  ├─ total_waste_cost ← calculated
  └─ status ← COMPLETED

┌─────────────────────────────────────────────────┐
│ PHASE 3: JOURNAL (Status: JOURNALED)            │
└─────────────────────────────────────────────────┘

Generate GL Entry:
  ├─ Based on actual + waste
  ├─ DEBIT 110502 (WIP in process)
  ├─ DEBIT 510301 (Waste, if waste > 0)
  ├─ CREDIT 110501 (Raw materials consumed)
  └─ status ← JOURNALED

┌─────────────────────────────────────────────────┐
│ ANALYSIS: Planned vs Actual Comparison          │
└─────────────────────────────────────────────────┘

Variance Analysis:
  ├─ Qty variance = actual - planned
  ├─ Cost variance = actual_cost - planned_cost
  ├─ Efficiency = actual ÷ planned
  └─ Waste %age = waste_qty ÷ actual_qty
```

### Real-World Example: Chicken Katsu (2 Juni 2025)

**PHASE 1: CREATE**

```
Input:
  production_date: 2025-06-02
  branch: Condet
  
WIP Selected: Chicken Katsu
  planned_batch_qty: 10 batches
  (Sushi 5pcs per batch, so planned output = 50 pcs)

Ingredients (from WIP master):
  1. Ayam Fillet:  1 kg per batch
  2. Tepung Roti:  0.2 kg per batch
  3. Telur:        2 pieces per batch
  4. Minyak:       0.5 L per batch
  5. Garam:        0.01 kg per batch

Cost Snapshot (from DB):
  1. Ayam Fillet:  Rp 50.000/kg
  2. Tepung Roti:  Rp 10.000/kg
  3. Telur:        Rp 2.000/piece
  4. Minyak:       Rp 30.000/L
  5. Garam:        Rp 5.000/kg

Calculated Planned State:
  ┌─────────────┬──────────┬────────────┬─────────────────┐
  │ Material    │ Per Btch │ Qty/Batch  │ Planned Total   │
  ├─────────────┼──────────┼────────────┼─────────────────┤
  │ Ayam        │ Rp 50k   │ 1kg × 10   │ Rp 500.000      │
  │ Tepung      │ Rp 10k   │ 0.2kg × 10 │ Rp 20.000       │
  │ Telur       │ Rp 2k    │ 2pc × 10   │ Rp 40.000       │
  │ Minyak      │ Rp 30k   │ 0.5L × 10  │ Rp 150.000      │
  │ Garam       │ Rp 5k    │ 0.01kg × 10│ Rp 500          │
  ├─────────────┼──────────┼────────────┼─────────────────┤
  │ TOTAL       │          │            │ Rp 710.500      │
  └─────────────┴──────────┴────────────┴─────────────────┘

Database State (DRAFT):
  production_orders:
    total_material_cost: 0 (not calculated yet)
    total_waste_cost: 0
    status: DRAFT
  
  production_order_lines:
    planned_batch_qty: 10
    actual_batch_qty: NULL
    total_yield: NULL
    total_cost: NULL
  
  production_order_materials (5 rows):
    planned_qty: [10, 2, 20, 5, 0.1]
    actual_qty: [NULL, NULL, NULL, NULL, NULL]
    waste_qty: [0, 0, 0, 0, 0]
    total_cost: [NULL, NULL, NULL, NULL, NULL]
```

**PHASE 2: COMPLETION (Chef's Input)**

Chef logs into detail page and enters actual results after finishing production:

```
Morning Shift Completion: 09:30

User Input:
  ├─ actual_batch_qty: 9 (1 batch gagal saat frying)
  └─ Material details:
    
    1. Ayam Fillet:
       ├─ actual_qty: 9.5 kg
       ├─ waste_qty: 0.3 kg (trim tulang ditemukan > expected)
       └─ waste_reason: "Trim tulang lebih banyak"
    
    2. Tepung Roti:
       ├─ actual_qty: 1.8 kg (lebih efisien)
       ├─ waste_qty: 0.15 kg (bercecer di meja)
       └─ waste_reason: "Spill saat coating"
    
    3. Telur:
       ├─ actual_qty: 19 pcs (kurang 1)
       ├─ waste_qty: 2 pcs (pecah saat mixing)
       └─ waste_reason: "Pecah saat mixing"
    
    4. Minyak:
       ├─ actual_qty: 5.2 L (lebih, karena deep fry perlu diisi)
       ├─ waste_qty: 0.3 L (tumpah saat diangkat)
       └─ waste_reason: "Tumpah saat diangkat dari wajan"
    
    5. Garam:
       ├─ actual_qty: 0.095 kg (lebih hemat)
       ├─ waste_qty: 0.01 kg (spill)
       └─ waste_reason: "Spill"

System Auto-Calculation:
  ┌─────────────┬──────────┬──────────┬──────────┬──────────────────┐
  │ Material    │ Planned  │ Actual   │ Waste    │ Cost             │
  ├─────────────┼──────────┼──────────┼──────────┼──────────────────┤
  │ Ayam        │ 10kg     │ 9.5kg    │ 0.3kg    │ 9.5 × Rp 50k     │
  │             │          │          │          │ = Rp 475.000     │
  │             │          │ (waste)  │          │ waste: Rp 15.000 │
  ├─────────────┼──────────┼──────────┼──────────┼──────────────────┤
  │ Tepung      │ 2kg      │ 1.8kg    │ 0.15kg   │ 1.8 × Rp 10k     │
  │             │          │          │          │ = Rp 18.000      │
  │             │          │          │          │ waste: Rp 1.500  │
  ├─────────────┼──────────┼──────────┼──────────┼──────────────────┤
  │ Telur       │ 20pc     │ 19pc     │ 2pc      │ 19 × Rp 2k       │
  │             │          │          │          │ = Rp 38.000      │
  │             │          │          │          │ waste: Rp 4.000  │
  ├─────────────┼──────────┼──────────┼──────────┼──────────────────┤
  │ Minyak      │ 5L       │ 5.2L     │ 0.3L     │ 5.2 × Rp 30k     │
  │             │          │          │          │ = Rp 156.000     │
  │             │          │          │          │ waste: Rp 9.000  │
  ├─────────────┼──────────┼──────────┼──────────┼──────────────────┤
  │ Garam       │ 0.1kg    │ 0.095kg  │ 0.01kg   │ 0.095 × Rp 5k    │
  │             │          │          │          │ = Rp 475         │
  │             │          │          │          │ waste: Rp 50     │
  ├─────────────┼──────────┼──────────┼──────────┼──────────────────┤
  │ TOTAL       │ Rp 710.5k│ Rp 687.5k│ Rp 29.5k │ Rp 687.475       │
  │             │          │          │ (waste)  │ waste: Rp 29.550 │
  └─────────────┴──────────┴──────────┴──────────┴──────────────────┘

Output Calculation:
  actual_batch_qty × yield_per_batch = 9 × 5 pcs = 45 pcs

Database Update:
  production_order_lines:
    actual_batch_qty: 9
    total_yield: 45 pcs
    total_cost: 9 × Rp 45.000 = Rp 405.000
    
  production_order_materials: (all 5 rows updated)
    actual_qty: [9.5, 1.8, 19, 5.2, 0.095]
    waste_qty: [0.3, 0.15, 2, 0.3, 0.01]
    waste_reason: [filled, filled, filled, filled, filled]
    total_cost: [475000, 18000, 38000, 156000, 475]
  
  production_orders:
    status: COMPLETED
    total_material_cost: 687475
    total_waste_cost: 29550
    completed_by: chef-123
    completed_at: 2025-06-02 09:30:00+07
```

**PHASE 3: JOURNAL GENERATION**

```
Accountant reviews and clicks "Generate Journal"

Validation:
  ✓ Status is COMPLETED
  ✓ Fiscal period for 2025-06-02 is open
  ✓ COA accounts exist (filtered by company_id):
    - 110501 (Raw Materials)
    - 110502 (WIP in Process)
    - 510301 (Waste/Scrap)

Journal Generated:
  ┌─────────────────────────────────────────────────┐
  │ Journal Entry                                   │
  ├─────────────────────────────────────────────────┤
  │ Number: GL-20250602-0001                        │
  │ Date: 2025-06-02                                │
  │ Source Module: food_production                  │
  │ Reference: PRD-CDT-20250602-001                 │
  │ Description: Production Katsu Condet            │
  ├─────────────────────────────────────────────────┤
  │ Account    │ Description      │ Debit    │Credit│
  ├────────────┼──────────────────┼──────────┼──────┤
  │ 110502     │ WIP in Process   │687.475   │      │
  │ 510301     │ Production Waste │ 29.550   │      │
  │ 110501     │ Raw Materials    │          │716k  │
  ├────────────┼──────────────────┼──────────┼──────┤
  │ TOTAL      │                  │716.975   │716k  │
  └─────────────────────────────────────────────────┘

Database Update:
  production_orders:
    status: JOURNALED
    journal_id: gl-20250602-0001
  
  journals: (new header + 3 lines created)
```

**COMPARISON REPORT**

```
Efficiency Analysis:
  ┌─────────────────────────────────────────────────┐
  │ Planned vs Actual Comparison                    │
  ├────────────┬──────────┬──────────┬──────────────┤
  │ Material   │ Planned  │ Actual   │ Variance     │
  ├────────────┼──────────┼──────────┼──────────────┤
  │ Ayam       │ 10 kg    │ 9.5 kg   │ -0.5kg (-5%) │
  │ Tepung     │ 2 kg     │ 1.8 kg   │ -0.2kg (-10%)│
  │ Telur      │ 20 pcs   │ 19 pcs   │ -1pc (-5%)   │
  │ Minyak     │ 5 L      │ 5.2 L    │ +0.2L (+4%)  │
  │ Garam      │ 0.1 kg   │ 0.095kg  │ -0.005kg     │
  └────────────┴──────────┴──────────┴──────────────┘

Cost Efficiency:
  Planned Cost:   Rp 710.500
  Actual Cost:    Rp 687.475
  Savings:        Rp 23.025 (3.2%)
  Waste Cost:     Rp 29.550 (4.3% of actual)
  
Production Rate:
  Planned Output: 50 pcs (10 batches × 5 pcs)
  Actual Output:  45 pcs (9 batches × 5 pcs)
  Yield Rate:     90% (9 out of 10 batches successful)
  
Waste Report:
  ┌──────────────┬─────┬──────────────────────┐
  │ Material     │ Qty │ Reason               │
  ├──────────────┼─────┼──────────────────────┤
  │ Ayam         │ 300g│ Trim tulang excess   │
  │ Tepung       │ 150g│ Spill during coating │
  │ Telur        │ 2pc │ Pecah saat mixing    │
  │ Minyak       │ 300ml│ Tumpah saat angkat  │
  │ Garam        │ 10g │ Spill                │
  └──────────────┴─────┴──────────────────────┘
```

### Code Implementation: Complete & Journal Generation

**Backend: Complete Production Order**

```typescript
// production-orders.service.ts

async complete(
  dto: CompleteProductionOrderDto,
  accessibleCompanyIds: string[]
): Promise<ProductionOrderWithDetails> {
  // 1. Load current order
  const order = await productionOrdersRepository
    .findByIdAccessible(dto.order_id, accessibleCompanyIds)
  
  if (order.status !== 'DRAFT') {
    throw new ProductionOrderNotDraftError()
  }

  // 2. Validate each material
  for (const line of dto.lines) {
    for (const material of line.materials) {
      if ((material.waste_qty || 0) > material.actual_qty) {
        throw new WasteExceedsActualError(
          material.product_id,
          material.actual_qty,
          material.waste_qty
        )
      }
    }
  }

  // 3. Calculate totals
  let totalMaterialCost = 0
  let totalWasteCost = 0

  const updatedLines = dto.lines.map(lineDto => {
    const line = order.lines.find(l => l.id === lineDto.id)!
    
    const lineWasteCost = lineDto.materials.reduce((sum, m) => {
      const material = line.materials.find(mat => mat.id === m.id)!
      return sum + (m.waste_qty * material.cost_per_unit)
    }, 0)

    lineDto.materials.forEach(m => {
      const material = line.materials.find(mat => mat.id === m.id)!
      const actualCost = m.actual_qty * material.cost_per_unit
      const wasteCost = (m.waste_qty || 0) * material.cost_per_unit
      totalMaterialCost += actualCost
      totalWasteCost += wasteCost
    })

    return {
      ...lineDto,
      total_yield: lineDto.actual_batch_qty * line.yield_per_batch,
      total_cost: lineDto.actual_batch_qty * line.cost_per_batch,
    }
  })

  // 4. Update order
  const updated = await productionOrdersRepository.updateOrderCompletion(
    order.id,
    {
      actual_lines: updatedLines,
      total_material_cost: totalMaterialCost,
      total_waste_cost: totalWasteCost,
      completed_by: dto.user_id,
    }
  )

  return updated
}
```

**Backend: Generate Journal**

```typescript
// production-orders.service.ts

async generateJournal(
  orderId: string,
  userId: string,
  accessibleCompanyIds: string[]
): Promise<{ journalId: string }> {
  const order = await productionOrdersRepository
    .findByIdAccessible(orderId, accessibleCompanyIds)
  
  if (order.status !== 'COMPLETED') {
    throw new ProductionOrderNotCompletedError()
  }

  // 1. Check fiscal period is open
  const period = await fiscalPeriodRepository.findByDate(
    order.company_id,
    order.production_date
  )
  
  if (!period || !period.is_open) {
    throw new FiscalPeriodClosedError()
  }

  // 2. Get COA accounts (filtered by company_id!)
  const wipAccount = await coaRepository.findByAccountCode(
    order.company_id,
    '110502' // WIP in Process
  )
  const rawMatAccount = await coaRepository.findByAccountCode(
    order.company_id,
    '110501' // Raw Materials
  )
  const wasteAccount = await coaRepository.findByAccountCode(
    order.company_id,
    '510301' // Waste/Scrap
  )

  if (!wipAccount || !rawMatAccount) {
    throw new COANotFoundError('Missing required accounts')
  }

  // 3. Create journal entry
  const journal = await journalRepository.withTransaction(async (client) => {
    // Create header
    const header = await journalRepository.insertHeader(client, {
      company_id: order.company_id,
      journal_date: order.production_date,
      journal_type: 'GENERAL',
      source_module: 'food_production',
      reference_type: 'production_order',
      reference_id: order.id,
      reference_number: order.order_number,
      description: `Production: ${order.order_number}`,
      created_by: userId,
    })

    const lines = []

    // DEBIT 110502 (WIP in Process)
    lines.push(
      await journalRepository.insertLine(client, {
        journal_id: header.id,
        account_id: wipAccount.id,
        debit: order.total_material_cost - order.total_waste_cost,
        credit: 0,
        line_number: 1,
      })
    )

    // If waste > 0: DEBIT 510301 (Waste account)
    if (order.total_waste_cost > 0 && wasteAccount) {
      lines.push(
        await journalRepository.insertLine(client, {
          journal_id: header.id,
          account_id: wasteAccount.id,
          debit: order.total_waste_cost,
          credit: 0,
          line_number: 2,
        })
      )
    }

    // CREDIT 110501 (Raw Materials)
    lines.push(
      await journalRepository.insertLine(client, {
        journal_id: header.id,
        account_id: rawMatAccount.id,
        debit: 0,
        credit: order.total_material_cost,
        line_number: wasteAccount ? 3 : 2,
      })
    )

    return { id: header.id, lines }
  })

  // 4. Update production order
  await productionOrdersRepository.updateStatus(orderId, {
    status: 'JOURNALED',
    journal_id: journal.id,
  })

  return { journalId: journal.id }
}
```

---

## Question 4: Bahan Terpakai dan Hasil Produksi

### Current State: Production Order Captures Intent Only

```
┌─────────────────────────────────────────────────┐
│ What Production Order DOES                       │
├─────────────────────────────────────────────────┤
│ ✅ Track planned material usage                 │
│ ✅ Track actual material usage + waste          │
│ ✅ Calculate costs (frozen at snapshot)         │
│ ✅ Generate GL entries (Bahan → WIP)            │
│ ✅ Audit trail of production                    │
│ ✅ Waste reporting                              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ What Production Order DOESN'T DO (YET)          │
├─────────────────────────────────────────────────┤
│ ❌ Automatically deduct from MAIN/READY         │
│ ❌ Automatically add to FINISHED_GOODS          │
│ ❌ Create stock movements                       │
│ ❌ Update warehouse balances                    │
│ ❌ Link to POS sales forecasting                │
└─────────────────────────────────────────────────┘
```

### Warehouse Architecture (Defined but Partial)

```
┌──────────────────────────────────┐
│ SUPPLIER                         │
└───────────────┬──────────────────┘
                │
                ▼
        ┌───────────────┐
        │ Goods Receipt │
        └───────┬───────┘
                │ confirm GR
                ▼
        ┌───────────────────────────┐
        │ Goods Processing confirm  │
        │ (receipt to ready movement)│
        └───────┬───────────────────┘
                │
                ▼ IN_PURCHASE movement
        ┌──────────────┐
        │ MAIN Gudang  │ ← Gudang utama per cabang
        │   Rp 50M     │
        └──────┬───────┘
               │
         ┌─────┴──────────────┐
         │ (Stock tidak turun) │
         │                    │
         ▼                    ▼
    ┌─────────────┐     ┌──────────────┐
    │ DPO (Daily  │     │ ???          │
    │ Prep Order) │     │ Production?  │
    └─────┬───────┘     └──────────────┘
          │ OUT_TRANSFER
          │ + IN_TRANSFER
          ▼
    ┌──────────────┐
    │ READY Gudang │ ← Bahan siap pakai per cabang
    │  Rp 10M      │
    └──────┬───────┘
           │
       ┌───┴──────┐
       ▼          ▼
   [POS]    [Production]
    Sales      (HERE!)
           (belum terintegrasi)
```

### Warehouse Types in System

```
MAIN            = Gudang 1 (Primary storage per branch)
READY           = Gudang 2 (Ready-to-use ingredients)
CENTRAL_STOCK   = Pusat warehouse (if multi-branch)
CENTRAL_KITCHEN = Central kitchen (if distributed production)
```

### Stock Movement Types (Already Defined, Awaiting Implementation)

```
IN_PURCHASE      ✅ Used (Supplier → MAIN)
OUT_TRANSFER     ✅ Used (MAIN → READY via DPO)
IN_TRANSFER      ✅ Used (Incoming to READY)

OUT_PRODUCTION   ⏳ TODO (READY → WIP out)
IN_PRODUCTION    ⏳ TODO (WIP finished → warehouse)

OUT_SALES        ⏳ TODO (READY → POS/Customer)
OUT_WASTE        ⏳ TODO (Any warehouse → Waste tracking)
ADJUSTMENT       ✅ Manual (Stock opname adjustments)
```

### Current Workflow for Production (Gap)

```
SCENARIO: 2 Juni, Chef selesai 10 batches Chicken Katsu

Current Flow:
  1. Chef inputs actual_qty + waste in production order
  2. System generates journal (Bahan → WIP)
  3. GL entries posted
  4. ❌ Stock MAIN/READY NOT UPDATED
  5. ❌ Finished goods NOT tracked in stock

Manual Workaround:
  Admin manually creates stock adjustment:
    ├─ OUT from READY: 9.5kg Ayam + waste
    ├─ IN to ???: 45 pcs Katsu (finished)
    └─ Or rely on POS to track sales
```

### What Needs to Be Built

#### Phase 1: Auto Stock Movements (Medium - 1-2 days)

```
POST /production-orders/{id}/complete → auto-trigger:

1. Create OUT_PRODUCTION movement
   ├─ warehouse_id: READY (default per branch)
   ├─ For each material:
   │  ├─ product_id
   │  ├─ qty: actual_qty (not waste)
   │  ├─ reason: production_order_id
   │  └─ cost: cost_per_unit (snapshot)
   ├─ Total OUT_PRODUCTION cost = total_material_cost
   └─ Status: COMPLETED → stock deducted

2. Create IN_PRODUCTION movement
   ├─ warehouse_id: ??? (need to define)
   ├─ product_id: wip_id (as product for tracking)
   ├─ qty: total_yield (45 pcs)
   ├─ cost: total_material_cost (frozen cost)
   └─ Status: COMPLETED → stock added

3. Update warehouse balances
   ├─ READY: -687.475 (material cost deducted)
   └─ FINISHED_GOODS: +687.475 (or READY if direct)

4. Create GL for stock movements
   ├─ Stock movement GL (non-impact, reconciliation only)
   └─ Reconcile with production journal
```

#### Phase 2: Finished Goods Tracking (Medium - 1-2 days)

```
Option A: Finished Goods Warehouse (Recommended)
  ├─ Create new warehouse type: FINISHED_GOODS
  ├─ Products table: add is_finished_good flag
  ├─ For each WIP, auto-create product variant:
  │  ├─ product_id: linked to WIP
  │  ├─ name: "{WIP_NAME} - FINISHED"
  │  ├─ unit_cost: total_material_cost / total_yield
  │  └─ warehouse: FINISHED_GOODS
  ├─ Track batch traceability
  └─ Link to POS sales

Option B: Stay in READY (Simpler)
  ├─ WIP output goes back to READY
  ├─ Mark as "finished goods" in stock level
  ├─ Lower cost per unit: cost / yield
  ├─ Track 1 unit = pre-measured portion
  └─ Simpler but less flexible
```

#### Phase 3: POS Integration (Medium - 1-2 days)

```
When POS records sale:
  ├─ Deduct from finished goods stock
  ├─ Calculate COGS automatically
  ├─ Reconcile with theoretical consumption
  └─ Update P&L in real-time
```

### Database Changes Needed

**Stock Movements Table** (Already exists but needs enhancement):

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  movement_type VARCHAR(20), -- OUT_PRODUCTION, IN_PRODUCTION
  
  -- Line items (already exists)
  product_id UUID,
  qty NUMERIC,
  cost_per_unit NUMERIC,
  
  -- Traceability
  reference_type VARCHAR(30), -- 'production_order'
  reference_id UUID,          -- production_order.id
  
  created_at TIMESTAMPTZ
)
```

**Proposed: Production Output Tracking**

```sql
CREATE TABLE production_output (
  id UUID PRIMARY KEY,
  production_order_id UUID FK,
  batch_number VARCHAR(50),
  
  -- What was produced
  output_product_id UUID FK,  -- Link to product (WIP as product)
  yield_qty NUMERIC,
  yield_uom VARCHAR(10),
  
  -- Cost per unit
  cost_per_unit NUMERIC,      -- total_material_cost / yield_qty
  total_cost NUMERIC,
  
  -- Where stored
  warehouse_id UUID FK,       -- FINISHED_GOODS or READY
  
  -- Quality tracking
  quality_check ENUM,         -- PASS, FAIL, PARTIAL
  quality_notes TEXT,
  
  -- Usage tracking
  used_qty NUMERIC DEFAULT 0,
  remaining_qty NUMERIC,
  
  created_at TIMESTAMPTZ
)
```

### Implementation Roadmap

```
Sprint 1 (Week 1):
  ├─ Design finished goods product model
  ├─ Create warehouse type: FINISHED_GOODS
  ├─ Add production output tracking table
  └─ Add stock movement creation in complete()

Sprint 2 (Week 2):
  ├─ Auto-create stock movements on complete
  ├─ Update warehouse balances on confirmation
  ├─ Add reports: Production → Stock reconciliation
  └─ Testing

Sprint 3 (Week 3):
  ├─ Integrate with POS sales deduction
  ├─ Add theoretical vs actual consumption reports
  ├─ Dashboard for stock aging (finished goods)
  └─ Production batch traceability
```

---

## Question 5: Journal dan Undo Flow

### Current Implementation Status

✅ **Void functionality implemented**  
✅ **Reversal journal auto-created for JOURNALED orders**  
⚠️ **Frontend UI buttons NOT YET added**

### Void Mechanism by Status

#### Scenario A: Void from DRAFT Status

```
Current State:
  status: DRAFT
  total_material_cost: 0
  total_waste_cost: 0
  journal_id: NULL

Action: POST /production-orders/{id}/void
  └─ body: { reason: "User error in batch qty" }

Backend Processing:
  1. Check status is DRAFT ✓
  2. Update order:
     ├─ status: VOID
     ├─ voided_by: user_id
     ├─ voided_at: now()
     └─ void_reason: "User error in batch qty"
  
  3. No journal to reverse (still DRAFT)
  4. Optional: Soft delete or keep for audit

Result:
  ├─ Order marked VOID
  ├─ Can view for audit
  ├─ No GL impact
  └─ No reversals needed
```

#### Scenario B: Void from COMPLETED Status

```
Current State:
  status: COMPLETED
  total_material_cost: 687.475
  total_waste_cost: 29.550
  journal_id: NULL (journal not generated yet)

Action: POST /production-orders/{id}/void
  └─ body: { reason: "Need to redo with different batch" }

Backend Processing:
  1. Check status is COMPLETED ✓
  2. No journal exists, so no reversal needed
  3. Update order:
     ├─ status: VOID
     ├─ voided_by: user_id
     ├─ voided_at: now()
     └─ void_reason: "Need to redo..."

Result:
  ├─ Order marked VOID
  ├─ GL entries NOT created
  ├─ Can create amendment order
  └─ Audit trail preserved
```

#### Scenario C: Void from JOURNALED Status (Complex)

```
Current State:
  status: JOURNALED
  total_material_cost: 687.475
  total_waste_cost: 29.550
  journal_id: gl-20250602-001

Original Journal GL Entry:
  ┌──────────────┬───────────┬─────────┐
  │ Account      │ Debit     │ Credit  │
  ├──────────────┼───────────┼─────────┤
  │ 110502 (WIP) │ 658.925   │         │ ← WIP - Waste
  │ 510301 (Wst) │ 29.550    │         │ ← Waste
  │ 110501 (Raw) │           │ 688.475 │ ← Total raw
  └──────────────┴───────────┴─────────┘

Action: POST /production-orders/{id}/void
  └─ body: { reason: "Incorrect recipe used" }

Backend Processing:
  1. Check status is JOURNALED ✓
  2. Load original journal: gl-20250602-001
  3. Create REVERSAL journal:
     ├─ Number: gl-20250602-001-RV
     ├─ Description: "[REVERSAL] Production PRD-CDT-20250602-001"
     ├─ Date: 2025-06-02
     └─ Lines (REVERSED):
        ├─ 110502 Credit 658.925
        ├─ 510301 Credit 29.550
        └─ 110501 Debit 688.475

  4. Mark original journal:
     ├─ is_reversed: true
     ├─ reversed_by_journal_id: gl-20250602-001-RV
     └─ Status: REVERSED (don't use in reports)

  5. Post reversal journal:
     └─ status: POSTED (auto-posted)

  6. Update production order:
     ├─ status: VOID
     ├─ voided_by: user_id
     ├─ voided_at: now()
     ├─ void_reason: "Incorrect recipe used"
     └─ (journal_id stays: gl-20250602-001)

Result after reversal:
  ┌─────────────────────────────────────────────┐
  │ GL State After Reversal                     │
  ├─────────────────────────────────────────────┤
  │ Original:  REVERSED (is_reversed = true)    │
  │ Reversal:  POSTED  (active)                 │
  │ Netting:   110502 = 0, 110501 = 0          │
  │ Effect:    GL completely neutralized        │
  │ History:   Both journals visible in reports │
  └─────────────────────────────────────────────┘

GL Report Shows:
  ┌─────────────────────────────────────────────┐
  │ GL History for Period 2025-06-02             │
  ├──────────────┬─────────┬────────┬───────────┤
  │ Account      │ Type    │ Amount │ Status    │
  ├──────────────┼─────────┼────────┼───────────┤
  │ 110502       │ Original│ 658.9k │ REVERSED  │
  │ 110502       │ Reversal│-658.9k │ POSTED    │
  │              │ Net     │ 0      │           │
  │              │         │        │           │
  │ 110501       │ Original│-688.5k │ REVERSED  │
  │ 110501       │ Reversal│ 688.5k │ POSTED    │
  │              │ Net     │ 0      │           │
  └──────────────┴─────────┴────────┴───────────┘
```

### Reversal Journal Creation SQL

```sql
-- Original Journal (marked as reversed)
UPDATE journal_headers
SET 
  is_reversed = true,
  reversed_by_journal_id = $1,
  updated_at = now()
WHERE id = $2;

-- New Reversal Journal Header
INSERT INTO journal_headers (
  company_id, journal_date, journal_type,
  source_module, reference_type, reference_id, reference_number,
  description, status, is_reversal, reverses_journal_id,
  created_by, created_at
) VALUES (
  'cmp-001', '2025-06-02', 'GENERAL',
  'food_production', 'production_order', 'order-001', 'PRD-CDT-20250602-001',
  '[REVERSAL] Production PRD-CDT-20250602-001', 'POSTED', true, 'gl-20250602-001',
  'user-123', now()
) RETURNING id;

-- Reversal Journal Lines (reversed debit/credit)
INSERT INTO journal_lines (
  journal_id, account_id, debit, credit, line_number, description
) VALUES
  ('gl-20250602-001-RV', 'acc-110502', 0, 658925, 1, 'Reversal'),
  ('gl-20250602-001-RV', 'acc-510301', 0, 29550, 2, 'Reversal'),
  ('gl-20250602-001-RV', 'acc-110501', 688475, 0, 3, 'Reversal');
```

### Backend Implementation: Void Endpoint

```typescript
// production-orders.service.ts

async void(
  orderId: string,
  dto: VoidProductionOrderDto,
  accessibleCompanyIds: string[]
): Promise<ProductionOrderWithDetails> {
  const order = await productionOrdersRepository
    .findByIdAccessible(orderId, accessibleCompanyIds)
  
  if (!['DRAFT', 'COMPLETED', 'JOURNALED'].includes(order.status)) {
    throw new ProductionOrderNotVoidableError(order.status)
  }

  return await productionOrdersRepository.withTransaction(async (client) => {
    // If JOURNALED, create reversal first
    if (order.status === 'JOURNALED' && order.journal_id) {
      const reversalJournal = await journalRepository.createReversal(
        client,
        order.journal_id,
        {
          created_by: dto.user_id,
        }
      )

      // Mark original as reversed
      await journalRepository.markAsReversed(
        client,
        order.journal_id,
        reversalJournal.id
      )
    }

    // Update order to VOID
    const updated = await productionOrdersRepository.updateStatus(
      client,
      orderId,
      {
        status: 'VOID',
        voided_by: dto.user_id,
        voided_at: new Date(),
        void_reason: dto.reason,
      }
    )

    return updated
  })
}
```

### Frontend Implementation Needed (TODO)

**Add buttons to ProductionOrderDetailPage:**

```typescript
// frontend/src/features/food-production/pages/ProductionOrderDetailPage.tsx

export default function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: order } = useProductionOrder(id)
  const voidMutation = useVoidProductionOrder()
  
  const handleVoid = async () => {
    const reason = prompt('Alasan void:')
    if (!reason) return
    
    try {
      await voidMutation.mutateAsync({
        order_id: id!,
        user_id: currentUser.id,
        reason,
      })
      toast.success('Production order di-void')
      navigate('/food-production/production')
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  return (
    <div>
      {/* ... order details ... */}

      {/* Status: DRAFT */}
      {order?.status === 'DRAFT' && (
        <div className="flex gap-2">
          <button
            onClick={handleVoid}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg"
          >
            🗑️ Hapus (Undo)
          </button>
        </div>
      )}

      {/* Status: COMPLETED */}
      {order?.status === 'COMPLETED' && (
        <div className="flex gap-2">
          <button
            onClick={async () => {
              // Generate journal
              await generateJournal.mutateAsync(id!)
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            📖 Generate Journal
          </button>
          <button
            onClick={handleVoid}
            className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg"
          >
            🔄 Batalkan
          </button>
        </div>
      )}

      {/* Status: JOURNALED */}
      {order?.status === 'JOURNALED' && (
        <div className="flex gap-2">
          <a
            href={`/accounting/journals/${order.journal_id}`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
          >
            📄 Lihat Journal
          </a>
          <button
            onClick={handleVoid}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg"
          >
            ↩️ Void & Reverse Journal
          </button>
        </div>
      )}

      {/* Status: VOID */}
      {order?.status === 'VOID' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">
            ✓ Void by {order.voided_by} on {order.voided_at}
            {order.void_reason && <br />}
            Reason: {order.void_reason}
          </p>
        </div>
      )}
    </div>
  )
}
```

### API Hooks Needed

```typescript
// Add to food-production.api.ts

export const useVoidProductionOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      order_id: string
      user_id: string
      reason: string
    }) => {
      const { data } = await api.post(
        `/production-orders/${payload.order_id}/void`,
        { user_id: payload.user_id, reason: payload.reason }
      )
      return data.data as ProductionOrderWithDetails
    },
    onSuccess: (order) => {
      qc.invalidateQueries({
        queryKey: ['food-production', 'production-orders'],
      })
      qc.setQueryData(
        ['food-production', 'production-order', order.id],
        order
      )
    },
  })
}

export const useGenerateProductionJournal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post(
        `/production-orders/${orderId}/generate-journal`,
        {}
      )
      return data.data
    },
    onSuccess: (result, orderId) => {
      qc.invalidateQueries({
        queryKey: ['food-production', 'production-order', orderId],
      })
    },
  })
}
```

### Important: No Hard Delete

```
❌ HARD DELETE NOT IMPLEMENTED

Reasons:
  1. Audit trail integrity - need historical record
  2. Financial reconciliation - GL needs complete history
  3. Tax compliance - Indonesia memerlukan keeping 30 years history
  4. Traceability - food safety regulations

Alternative: SOFT DELETE (for DRAFT only)
  
  POST /production-orders/{id}/delete
    ├─ Check: status must be DRAFT
    ├─ Update: is_deleted = true, deleted_at = now()
    └─ Recovery: Can restore if needed

For "redo" scenarios:
  1. Void the order (creates reversal journal if needed)
  2. Create new production order (amendment)
  3. Both visible in audit trail
```

---

## Implementation Gaps

### Gap 1: Stock Movement Integration

**Status**: ⏳ Not Implemented  
**Complexity**: Medium  
**Effort**: 1-2 days

**What's Missing:**
- Auto creation of OUT_PRODUCTION movement when order completes
- Auto creation of IN_PRODUCTION for finished goods
- Update warehouse balances
- Reconciliation reports

**Impact**: 
- Stock balances don't reflect actual production
- Finished goods not tracked in inventory
- POS can't auto-deduct from finished goods

### Gap 2: Frontend Void Buttons

**Status**: ⏳ Not Implemented  
**Complexity**: Low  
**Effort**: 2-3 hours

**What's Missing:**
- Void button on DRAFT orders
- Void button on COMPLETED orders
- Void button on JOURNALED orders (with reversal confirmation)
- UI to show VOID status

**Impact**:
- Users can't undo orders via UI
- Must use backend directly (not user-friendly)

### Gap 3: Amendment Order Flow

**Status**: ⏳ Not Implemented  
**Complexity**: Medium  
**Effort**: 1-2 days

**What's Missing:**
- Ability to create "amendment" order from existing
- Copy original lines/materials, modify, re-process
- Link amendment to original for traceability

**Impact**:
- Hard to fix mistakes without full redo
- No clear change tracking

### Gap 4: Finished Goods Tracking

**Status**: ⏳ Not Implemented  
**Complexity**: Medium  
**Effort**: 1-2 days

**What's Missing:**
- Finished goods warehouse definition
- Product model for finished goods
- Batch-level traceability
- Cost per unit calculation for output

**Impact**:
- Production output not tracked in stock
- Can't link to POS sales
- No batch traceability for recalls

### Gap 5: POS Integration

**Status**: ⏳ Not Implemented  
**Complexity**: Medium  
**Effort**: 2-3 days

**What's Missing:**
- Auto-deduction from finished goods on POS sale
- COGS auto-calculation from production cost
- Theoretical vs actual consumption reports
- Reconciliation workflows

**Impact**:
- Stock balances don't match reality
- COGS calculated manually
- No real-time P&L

---

## Next Steps

### Priority 1 (High Value, Low Effort) - Do First

- [ ] **Add Void Buttons to Detail Page** (2-3 hours)
  - Void from DRAFT/COMPLETED/JOURNALED
  - Show reversal confirmation for JOURNALED
  - Update status display

- [ ] **Complete Frontend API Hooks** (1 hour)
  - `useVoidProductionOrder`
  - `useGenerateProductionJournal`
  - `useCompleteProductionOrder`

### Priority 2 (Medium Value, Medium Effort) - Do Second

- [ ] **Stock Movement Integration** (1-2 days)
  - Auto-create OUT_PRODUCTION on complete
  - Auto-create IN_PRODUCTION for finished goods
  - Update warehouse balances
  - Add validation for stock availability

- [ ] **Amendment Order Flow** (1-2 days)
  - "Create Amendment" button on VOID orders
  - Copy + modify flow
  - Link traceability

### Priority 3 (High Value, High Effort) - Do Later

- [ ] **Finished Goods Tracking** (1-2 days)
  - Define finished goods warehouse
  - Product model enhancement
  - Batch traceability

- [ ] **POS Integration** (2-3 days)
  - Auto-deduction on sales
  - COGS calculation
  - Reconciliation reports

---

## Conclusion

**Production Order System Status:**

| Feature | Status | Notes |
|---------|--------|-------|
| WIP Position Filter | ✅ Done | Working, used in create |
| Create Order Flow | ✅ Done | Transaction-based, safe |
| Planned/Actual Tracking | ✅ Done | Captured and calculated |
| Journal Generation | ✅ Done | Auto GL entries, no waste split yet |
| Void & Reversal | ✅ Done | Backend ready, UI missing |
| Stock Integration | ❌ Gap | Not auto-triggered |
| Finished Goods | ❌ Gap | Not tracked |
| POS Integration | ❌ Gap | Manual only |
| Amendment Orders | ❌ Gap | No formal flow |

**Total Coverage**: ~60% Complete, ~40% Gaps

**Recommendation**: 
1. Ship what's done (create, complete, journal, void)
2. Add UI buttons (void) immediately
3. Then tackle stock integration + POS

---

## References

- `/backend/src/modules/food-production/` - Source code
- `/.amazonq/docs/PRODUCTION_ORDER_DESIGN.md` - Original design doc
- `/backend/database/migrations/` - DB schema
- `/frontend/src/features/food-production/` - Frontend implementation
