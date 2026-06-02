# Production Order - Action Items & Quick Reference

> Last Updated: 2 Juni 2025  
> Quick checklist untuk implementasi selanjutnya

---

## 📋 Quick Facts

| Aspek | Status | Notes |
|-------|--------|-------|
| **Position Filter (Q1)** | ✅ DONE | `filter_by_position=true` → works |
| **Create Order Flow (Q2)** | ✅ DONE | Snapshot everything, safe transaction |
| **Planned vs Actual (Q3)** | ✅ DONE | Tracked per-material, calc per-batch |
| **Stock Integration (Q4)** | ⏳ NEXT | Not auto, currently manual |
| **Journal & Void (Q5)** | ✅ Backend DONE | UI buttons missing |

---

## 🎯 Immediate Action Items (This Week)

### 1️⃣ Add Void Buttons to ProductionOrderDetailPage

**File**: `/frontend/src/features/food-production/pages/ProductionOrderDetailPage.tsx`

**Time**: 2-3 hours  
**Complexity**: Low

**Checklist**:
- [ ] Import `useVoidProductionOrder` hook
- [ ] Add button for status DRAFT: "🗑️ Hapus (Undo)"
- [ ] Add button for status COMPLETED: "🔄 Batalkan"
- [ ] Add button for status JOURNALED: "↩️ Void & Reverse Journal"
- [ ] Show void reason + audit trail on VOID status
- [ ] Add confirmation dialog before void
- [ ] Test all 3 scenarios

**Template Code**:
```typescript
const handleVoid = async () => {
  const reason = prompt('Alasan void:')
  if (!reason) return
  
  try {
    await voidMutation.mutateAsync({
      order_id: id!,
      reason,
    })
    toast.success('Production order di-void')
    navigate('/food-production/production')
  } catch (err) {
    toast.error(parseApiError(err))
  }
}
```

---

### 2️⃣ Add Missing API Hooks

**File**: `/frontend/src/features/food-production/api/food-production.api.ts`

**Time**: 1 hour  
**Complexity**: Low

**Checklist**:
- [ ] Add `useVoidProductionOrder` hook
- [ ] Add `useGenerateProductionJournal` hook  
- [ ] Add `useCompleteProductionOrder` hook (if missing)
- [ ] Add `useDeleteProductionOrder` hook (DRAFT only, soft delete)

**Template Code**:
```typescript
export const useVoidProductionOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      order_id: string
      reason: string
    }) => {
      const { data } = await api.post(
        `/production-orders/${payload.order_id}/void`,
        { reason: payload.reason }
      )
      return data.data as ProductionOrderWithDetails
    },
    onSuccess: (order) => {
      qc.invalidateQueries({
        queryKey: ['food-production', 'production-orders'],
      })
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
    onSuccess: (_, orderId) => {
      qc.invalidateQueries({
        queryKey: ['food-production', 'production-order', orderId],
      })
    },
  })
}
```

---

### 3️⃣ Test Void Flow (All Scenarios)

**Time**: 1-2 hours  
**Complexity**: Low

**Checklist**:
- [ ] Create order → void from DRAFT → verify status = VOID, no journal
- [ ] Create order → complete → void from COMPLETED → verify status = VOID, no reversal
- [ ] Create order → complete → generate journal → void from JOURNALED
  - [ ] Verify reversal journal created with "[REVERSAL]" description
  - [ ] Verify original journal marked `is_reversed = true`
  - [ ] Verify GL balances net to zero
  - [ ] Verify audit trail preserved
- [ ] Verify soft deleted orders (DRAFT) can be restored if needed
- [ ] Verify void reason captured in audit trail

**Test Cases**:

```sql
-- Verify void scenario 1 (DRAFT)
SELECT order_number, status, journal_id, voided_by, voided_at, void_reason
FROM production_orders
WHERE status = 'VOID' AND journal_id IS NULL;
-- Expected: No journal, void audit fields filled

-- Verify void scenario 3 (JOURNALED with reversal)
SELECT 
  h.order_number, h.status, h.journal_id,
  j.id as original_journal_id, j.is_reversed,
  jr.id as reversal_journal_id, jr.is_reversal
FROM production_orders h
JOIN journal_headers j ON h.journal_id = j.id
JOIN journal_headers jr ON j.reversed_by_journal_id = jr.id
WHERE h.status = 'VOID';
-- Expected: Original marked reversed, reversal journal linked

-- Verify GL net to zero
SELECT account_id, SUM(debit) as total_debit, SUM(credit) as total_credit
FROM journal_lines
WHERE journal_id IN (
  SELECT reversed_by_journal_id FROM journal_headers WHERE is_reversed = true
)
GROUP BY account_id;
-- Expected: Each account has debit = credit
```

---

## 📅 Next Sprint Items (Next 1-2 Weeks)

### 4️⃣ Stock Movement Integration

**Files**:
- `/backend/src/modules/stock-movements/` (already exists)
- `/backend/src/modules/food-production/production-orders/production-orders.service.ts` (modify complete method)

**Time**: 1-2 days  
**Complexity**: Medium  
**Effort**: 15-20 hours

**Checklist**:
- [ ] Understand existing stock-movements module
- [ ] Define finished goods warehouse type
- [ ] Create `createStockMovements()` function
  - [ ] OUT_PRODUCTION for materials consumed
  - [ ] IN_PRODUCTION for WIP output
- [ ] Call from `complete()` method → auto-trigger on complete
- [ ] Update warehouse balances
- [ ] Add validation: check READY stock availability (if strict mode)
- [ ] Add reports: Production → Stock reconciliation
- [ ] Test with real data

**Flow Pseudocode**:
```typescript
// When production order completes
async complete(orderId, data) {
  // ... existing validation & calculation ...
  
  // NEW: Create stock movements
  await this.createStockMovements(orderId, {
    // OUT_PRODUCTION: bahan keluar dari READY
    // IN_PRODUCTION: hasil masuk ke FINISHED_GOODS
    // OR back to READY if no finished goods warehouse
  })
  
  // ... rest of logic ...
}
```

---

### 5️⃣ Amendment Order Flow

**Files**:
- `/backend/src/modules/food-production/production-orders/` (new method)
- `/frontend/src/features/food-production/pages/` (new page or modal)

**Time**: 1-2 days  
**Complexity**: Medium  
**Effort**: 15-20 hours

**Checklist**:
- [ ] Add `createAmendment(orderId)` endpoint → copy from original
- [ ] Allow user to modify lines/materials
- [ ] Link amendment to original (`amended_from` or similar)
- [ ] Show amendment in detail page as related
- [ ] Add button: "Create Amendment" on VOID orders
- [ ] Add report: Amendment trail
- [ ] Test amendment + journal + reversal flow

**Schema Idea**:
```typescript
interface ProductionOrder {
  // ... existing fields ...
  amended_from_id?: string  // FK to original if this is amendment
  is_amendment: boolean
}
```

---

### 6️⃣ Finished Goods Tracking

**Files**:
- `/backend/src/modules/products/` (enhance model)
- `/backend/database/migrations/` (new table: production_output)
- `/backend/src/modules/food-production/` (new service: finished-goods)

**Time**: 1-2 days  
**Complexity**: Medium  
**Effort**: 15-20 hours

**Checklist**:
- [ ] Create finished goods warehouse type
- [ ] Define product model: is_wip, is_finished_good flags
- [ ] Create production_output table
  - [ ] Link to production_order
  - [ ] Track batch_number, yield_qty, cost_per_unit
  - [ ] Track warehouse location
  - [ ] Track quality check status
- [ ] Auto-create product record for each WIP (link)
- [ ] Calculate cost_per_unit on output
- [ ] Add batch traceability reports
- [ ] Add shelf-life tracking (optional)

**Table Design**:
```sql
CREATE TABLE production_output (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id),
  production_line_id UUID NOT NULL,
  
  batch_number VARCHAR(50),      -- PRD-CDT-20250602-001-BATCH-01
  
  -- Output product
  product_id UUID NOT NULL REFERENCES products(id),
  yield_qty NUMERIC NOT NULL,
  yield_uom VARCHAR(10) NOT NULL,
  
  -- Cost per unit
  cost_per_unit NUMERIC NOT NULL,  -- total_cost / yield_qty
  total_cost NUMERIC NOT NULL,
  
  -- Where stored
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  
  -- Quality control
  quality_status VARCHAR(20) DEFAULT 'PENDING', -- PASS, FAIL, PARTIAL
  quality_notes TEXT,
  quality_checked_by UUID,
  quality_checked_at TIMESTAMPTZ,
  
  -- Usage tracking
  used_qty NUMERIC DEFAULT 0,
  remaining_qty NUMERIC NOT NULL,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
```

---

### 7️⃣ POS Integration

**Files**:
- `/backend/src/modules/pos/` (modify sales endpoint)
- `/backend/src/modules/food-production/` (add consumption tracking)
- Reports

**Time**: 2-3 days  
**Complexity**: High  
**Effort**: 20-30 hours

**Checklist**:
- [ ] Add trigger: When POS sale recorded
- [ ] Auto-deduct from finished_goods stock
- [ ] Calculate COGS from production cost
- [ ] Create stock movement: OUT_SALES
- [ ] Link to production batch for traceability
- [ ] Add reconciliation: Theoretical vs Actual consumption
- [ ] Add reports:
  - [ ] Production → Sales → Waste tracking
  - [ ] COGS reconciliation
  - [ ] Batch aging (finished goods shelf-life)
  - [ ] Margin analysis (revenue vs COGS)
- [ ] Test with multiple batches, dates, products

**Integration Flow**:
```typescript
// When POS records sale
async recordSale(saleData) {
  // 1. Check finished goods available
  const stock = await getFinishedGoodsStock(product_id, qty)
  if (stock < qty) throw new InsufficientStockError()
  
  // 2. Record sale
  const sale = await createSale(saleData)
  
  // 3. Auto-deduct from finished goods
  await deductFromFinishedGoods(product_id, qty, {
    source: 'pos_sale',
    reference_id: sale.id
  })
  
  // 4. Calculate COGS from batches
  const cogs = await calculateCOGS(product_id, qty)
  
  // 5. Update P&L
  // ... journal entry ...
  
  return sale
}
```

---

## 📊 Status Dashboard

### What's Working ✅

```
┌─────────────────────────────────────────┐
│ PRODUCTION ORDER LIFECYCLE              │
├─────────────────────────────────────────┤
│ CREATE (DRAFT)                          │
│  ├─ Position filter                 ✅   │
│  ├─ Snapshot all data               ✅   │
│  ├─ Safe transaction                ✅   │
│  └─ Cost calculation                ✅   │
│                                        │
│ COMPLETE (COMPLETED)                   │
│  ├─ Input actual qty                ✅   │
│  ├─ Track waste                     ✅   │
│  ├─ Calculate totals                ✅   │
│  └─ Update status                   ✅   │
│                                        │
│ JOURNAL (JOURNALED)                    │
│  ├─ Generate GL entries             ✅   │
│  ├─ Split waste account             ⏳   │
│  ├─ Auto-post                       ✅   │
│  └─ Link to GL                      ✅   │
│                                        │
│ VOID (VOID)                            │
│  ├─ Soft delete (DRAFT)             ✅   │
│  ├─ Mark void (COMPLETED)           ✅   │
│  ├─ Reverse journal                 ✅   │
│  └─ Audit trail                     ✅   │
└─────────────────────────────────────────┘

Backend: ~85% Complete
Frontend: ~40% Complete (UI missing)
```

### What's Missing ❌

```
┌─────────────────────────────────────────┐
│ STOCK & INVENTORY INTEGRATION           │
├─────────────────────────────────────────┤
│ ❌ AUTO deduct from READY warehouse
│ ❌ AUTO add to FINISHED_GOODS
│ ❌ Real-time stock sync
│ ❌ Batch traceability
│ ❌ POS auto-deduction
│ ❌ Amendment orders
│ └─ Total Impact: 40% of value
└─────────────────────────────────────────┘
```

---

## 🔗 Related Systems

### Stock Transfers
- **Path**: `/backend/src/modules/stock-transfers/`
- **Usage**: Will leverage for OUT_PRODUCTION + IN_PRODUCTION

### Journals
- **Path**: `/backend/src/modules/accounting/journals/`
- **Usage**: Production journal + reversal logic

### Warehouses
- **Path**: `/backend/src/modules/warehouses/`
- **Status**: Need to define FINISHED_GOODS type

### Products
- **Path**: `/backend/src/modules/products/`
- **Enhancement**: Link products to WIP, track finished goods

### POS
- **Path**: `/backend/src/modules/pos/`
- **Integration**: Auto-deduct on sale

---

## 📝 SQL Queries for Testing

### Test 1: Verify Order Creation

```sql
-- Check production order with all details
SELECT 
  po.order_number,
  po.status,
  po.production_date,
  po.total_material_cost,
  COUNT(DISTINCT pol.id) as line_count,
  COUNT(DISTINCT pom.id) as material_count
FROM production_orders po
LEFT JOIN production_order_lines pol ON pol.production_order_id = po.id
LEFT JOIN production_order_materials pom ON pom.production_order_id = po.id
WHERE po.order_number = 'PRD-CDT-20250602-001'
GROUP BY po.id, po.order_number, po.status, po.production_date, po.total_material_cost;

-- Check materials snapshot
SELECT 
  pom.product_code,
  pom.product_name,
  pom.planned_qty,
  pom.cost_per_unit,
  pom.cost_source
FROM production_order_materials pom
WHERE pom.production_order_id = (
  SELECT id FROM production_orders WHERE order_number = 'PRD-CDT-20250602-001'
)
ORDER BY pom.sort_order;
```

### Test 2: Verify Completion

```sql
-- Check completion data
SELECT 
  po.order_number,
  po.status,
  pol.planned_batch_qty,
  pol.actual_batch_qty,
  pol.total_yield,
  pol.total_cost,
  po.total_material_cost,
  po.total_waste_cost,
  po.completed_by,
  po.completed_at
FROM production_orders po
JOIN production_order_lines pol ON pol.production_order_id = po.id
WHERE po.order_number = 'PRD-CDT-20250602-001';

-- Check waste per material
SELECT 
  pom.product_name,
  pom.actual_qty,
  pom.waste_qty,
  pom.waste_reason,
  ROUND((pom.waste_qty::numeric / pom.actual_qty::numeric * 100), 2) as waste_percent
FROM production_order_materials pom
WHERE pom.production_order_id = (
  SELECT id FROM production_orders WHERE order_number = 'PRD-CDT-20250602-001'
)
ORDER BY pom.sort_order;
```

### Test 3: Verify Journal

```sql
-- Check journal generated
SELECT 
  jh.id,
  jh.journal_type,
  jh.source_module,
  jh.reference_number,
  jh.status,
  COUNT(jl.id) as line_count
FROM journal_headers jh
LEFT JOIN journal_lines jl ON jl.journal_id = jh.id
WHERE jh.reference_type = 'production_order'
  AND jh.reference_number = 'PRD-CDT-20250602-001'
GROUP BY jh.id, jh.journal_type, jh.source_module, jh.reference_number, jh.status;

-- Check journal lines
SELECT 
  ca.account_code,
  ca.account_name,
  jl.debit,
  jl.credit,
  CASE 
    WHEN jl.debit > 0 THEN 'DEBIT'
    WHEN jl.credit > 0 THEN 'CREDIT'
  END as type
FROM journal_lines jl
JOIN chart_of_accounts ca ON ca.id = jl.account_id
WHERE jl.journal_id = (
  SELECT journal_id FROM production_orders WHERE order_number = 'PRD-CDT-20250602-001'
)
ORDER BY jl.line_number;
```

### Test 4: Verify Reversal

```sql
-- Check reversal journal
SELECT 
  jh.id,
  jh.description,
  jh.is_reversed,
  jh.is_reversal,
  jh.reversed_by_journal_id,
  jh.reverses_journal_id,
  jh.status
FROM journal_headers jh
WHERE jh.reference_number = 'PRD-CDT-20250602-001'
ORDER BY jh.created_at;

-- Verify GL net to zero
WITH journal_data AS (
  SELECT jh.id, jh.is_reversal, jl.account_id, jl.debit, jl.credit
  FROM journal_headers jh
  JOIN journal_lines jl ON jl.journal_id = jh.id
  WHERE jh.reference_number = 'PRD-CDT-20250602-001'
)
SELECT 
  account_id,
  COALESCE(SUM(CASE WHEN is_reversal THEN -debit ELSE debit END), 0) as total_debit,
  COALESCE(SUM(CASE WHEN is_reversal THEN -credit ELSE credit END), 0) as total_credit
FROM journal_data
GROUP BY account_id
HAVING COALESCE(SUM(CASE WHEN is_reversal THEN -debit ELSE debit END), 0) <> 0
  OR COALESCE(SUM(CASE WHEN is_reversal THEN -credit ELSE credit END), 0) <> 0;
-- Expected: Empty result (all net to zero)
```

---

## 📞 Contact & Questions

**For Architecture Questions**: Refer to `/backend/src/modules/food-production/production-orders/production-orders.service.ts`  
**For DB Questions**: Refer to design doc + migrations  
**For Frontend Questions**: Refer to `/frontend/src/features/food-production/pages/`

---

## Timeline Estimate

| Item | Effort | Priority | Timeline |
|------|--------|----------|----------|
| Void Buttons | 2-3h | P0 | This week |
| API Hooks | 1h | P0 | This week |
| Testing Void | 1-2h | P1 | This week |
| Stock Integration | 1-2d | P2 | Next week |
| Amendment Orders | 1-2d | P2 | 2 weeks |
| Finished Goods | 1-2d | P1 | 2 weeks |
| POS Integration | 2-3d | P1 | 3 weeks |

**Total**: ~12-15 days of development to fully complete

---

## Done Checklist

Use this to track progress:

```
Week 1 (This Week):
  [ ] Void buttons added + tested
  [ ] API hooks implemented
  [ ] Void flow end-to-end tested

Week 2:
  [ ] Stock movement integration done
  [ ] Amendment order flow working
  [ ] Production → Stock reconciliation tested

Week 3:
  [ ] Finished goods tracking implemented
  [ ] POS integration started

Week 4:
  [ ] POS integration complete
  [ ] Full system tested
  [ ] Documentation updated
  [ ] Ready for QA
```

