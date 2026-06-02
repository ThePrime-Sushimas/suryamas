# Work Summary: WIP Output Warehouse Feature

**Date**: June 2, 2026  
**Status**: ✅ COMPLETE - Ready for Testing

---

## What We Built

### Feature Overview
Added ability untuk WIP items untuk specify output warehouse destination:
- **READY** (default) - Hasil produksi ke gudang READY (branch-local)
- **FINISHED_GOODS** - Hasil produksi ke gudang FINISHED_GOODS (central kitchen)

Ketika FINISHED_GOODS dipilih, user harus select `output_product_id` untuk track finished goods output sebagai stock IN_PRODUCTION movement.

---

## What Was Implemented

### ✅ Backend Changes

#### 1. Database Schema
- **File**: `backend/database/migrations/20260602_add_output_warehouse_to_wip_items.sql`
- **Added columns**:
  - `output_warehouse` (VARCHAR(50), DEFAULT 'READY', CHECK constraint)
  - `output_product_id` (UUID, FK to products, nullable)
- **File**: `backend/database/migrations/20260602_add_finished_goods_warehouse_type.sql`
- **Updated**: warehouses table CHECK constraint untuk allow FINISHED_GOODS type

#### 2. Validation Schema
- **File**: `backend/src/modules/food-production/wip/wip.schema.ts`
- **Added**:
  - `output_warehouse` enum field di createWipItemSchema & updateWipItemSchema
  - `output_product_id` uuid field
  - **Cross-field validation** (.refine): Jika output_warehouse = FINISHED_GOODS, output_product_id wajib diisi
  - Edge case handling: Pakai `== null` untuk handle partial PATCH updates

#### 3. Type Definitions
- **File**: `backend/src/modules/food-production/wip/wip.types.ts`
- **Updated interfaces**:
  - `WipItem` - added both fields
  - `CreateWipItemDto` - added both fields
  - `UpdateWipItemDto` - added both fields

#### 4. Production Orders Service
- **File**: `backend/src/modules/food-production/production-orders/production-orders.service.ts`
- **Fixed issues**:
  - `avg_cost` tidak di-reset ke 0 saat stok habis (CRITICAL FIX)
  - Properly handle output warehouse routing (READY vs FINISHED_GOODS)
  - Support IN_PRODUCTION movement untuk finished goods output

#### 5. Production Orders Repository
- **File**: `backend/src/modules/food-production/production-orders/production-orders.repository.ts`
- **Simplified**:
  - `updateMaterialStockMovementRef()` - hapus parameter `type`, hardcode ke OUT only
  - Materials hanya track OUT_PRODUCTION (barang keluar dari gudang)
  - IN_PRODUCTION movements tracked di production_order_lines saja

#### 6. Bug Fixes
- **Parameter indexing** di `wip.repository.findAllWithPositions()`:
  - Changed `limitIdx = idx + 1` → `limitIdx = params.length + 1`
  - Fixes "could not determine data type of parameter" error
  - Proper separation antara filter params dan pagination params

---

### ✅ Frontend Changes

#### 1. Type Definitions
- **File**: `frontend/src/features/food-production/types/food-production.types.ts`
- **Updated**:
  - `WipItem` interface - added output_warehouse & output_product_id fields
  - `ProductionOrderLine` interface - added same fields untuk display di production order

#### 2. API Hooks
- **File**: `frontend/src/features/food-production/api/food-production.api.ts`
- **Updated**:
  - `useCreateWipItem()` - body type includes new fields
  - `useUpdateWipItem()` - body type includes new fields
  - `ProductionOrderLine` interface - added fields untuk menampilkan warehouse destination

#### 3. WIP Detail Form
- **File**: `frontend/src/features/food-production/pages/WipDetailPage.tsx`
- **Added state management**:
  - `outputWarehouse` state (READY | FINISHED_GOODS)
  - `outputProductId` state (string)
- **Data sync**:
  - useEffect sync dari server data saat WIP loaded
- **API mutations**:
  - `handleSave()` include both fields di create & update calls
- **UI Components**:
  - **Output Warehouse selector** - dropdown dengan 2 pilihan
  - **Conditional Product selector** - hanya muncul saat FINISHED_GOODS dipilih
  - **Loading state** - dropdown disabled & placeholder berubah saat products sedang di-fetch
  - Helper text untuk explain warehouse destination

#### 4. Production Order Form
- **File**: `frontend/src/features/food-production/pages/ProductionOrderForm.tsx`
- **Added**:
  - WIP dropdown sekarang show warehouse destination badge:
    - `[→ FG]` untuk FINISHED_GOODS
    - `[→ Ready]` untuk READY
  - Helps user see di mana hasil produksi akan masuk

#### 5. Production Order Detail
- **File**: `frontend/src/features/food-production/pages/ProductionOrderDetailPage.tsx`
- **Added**:
  - Warehouse badge display di bawah WIP name:
    - **Purple badge "→ Finished Goods"** untuk FINISHED_GOODS
    - **Blue badge "→ Ready"** untuk READY
  - Visual confirmation tentang warehouse routing

---

## Architecture Summary

```
WIP Form (Frontend)
  ├─ Select output_warehouse (READY/FINISHED_GOODS)
  ├─ If FINISHED_GOODS → Select output_product_id
  └─ Save → API POST/PUT

WIP API (Backend)
  ├─ Zod validation (cross-field: FG requires product_id)
  ├─ Service layer (business logic)
  └─ Repository layer (DB queries)
       └─ Store: output_warehouse, output_product_id

Production Order (Backend)
  ├─ Load WIP with output config
  ├─ Determine source warehouse:
  │    ├─ READY WIP → bahan dari READY
  │    └─ FINISHED_GOODS WIP → bahan dari MAIN
  ├─ OUT_PRODUCTION movement (deduct materials)
  ├─ IN_PRODUCTION movement (add finished goods)
  │    └─ IF output_product_id exists
  └─ Update stock balances (retain avg_cost)

Production Order (Frontend)
  ├─ Show warehouse destination per line
  └─ Visual feedback untuk user
```

---

## Testing Checklist

### 🔵 SMOKE TESTS (Basic Functionality)

#### WIP Management
- [ ] **Create WIP with READY warehouse**
  - Navigate to `/food-production/wip/new`
  - Fill in WIP details (code, name, ingredients)
  - Leave "Output Warehouse" as READY (default)
  - Product selector should NOT appear
  - Save → should succeed

- [ ] **Create WIP with FINISHED_GOODS warehouse**
  - Navigate to `/food-production/wip/new`
  - Fill in WIP details
  - Select "Output Warehouse" = FINISHED_GOODS
  - Product selector SHOULD appear
  - Select a product from dropdown
  - Save → should succeed

- [ ] **Edit WIP - change warehouse**
  - Open existing WIP
  - Change "Output Warehouse" from READY to FINISHED_GOODS
  - Product selector appears
  - Select product
  - Save → should succeed
  - Refresh page → values persist

- [ ] **Validation: FINISHED_GOODS without product**
  - Try to save WIP with FINISHED_GOODS but NO product selected
  - Should get validation error: "output_product_id wajib diisi"

### 🔵 PRODUCTION ORDER TESTS

#### Order Creation
- [ ] **Create order with READY WIP**
  - Go to `/food-production/production/new`
  - Select branch
  - Add WIP with READY warehouse
  - Should see `[→ Ready]` badge in dropdown
  - Create order → should succeed

- [ ] **Create order with FINISHED_GOODS WIP**
  - Go to `/food-production/production/new`
  - Select branch
  - Add WIP with FINISHED_GOODS warehouse
  - Should see `[→ FG]` badge in dropdown
  - Create order → should succeed

- [ ] **Mixed order (both warehouse types)**
  - Create order dengan 2 WIPs:
    - 1x READY warehouse
    - 1x FINISHED_GOODS warehouse
  - Create → should succeed
  - Detail page should show correct badges untuk each line

#### Order Detail & Display
- [ ] **Detail page shows warehouse badges**
  - Open any production order
  - Check each line header:
    - READY lines → blue "→ Ready" badge
    - FINISHED_GOODS lines → purple "→ Finished Goods" badge
  - Badges should be visible & color-coded

### 🟡 STOCK MOVEMENT TESTS (Critical Business Logic)

#### Material Deduction (OUT_PRODUCTION)
- [ ] **Stock deducted from correct warehouse**
  - Create order untuk READY WIP
  - Complete order dengan actual quantities
  - Generate journal
  - Check stock_movements:
    - OUT_PRODUCTION dari READY warehouse ✓
    - Quantity correct ✓
    - avg_cost retained (NOT reset to 0) ✓

- [ ] **Stock deducted untuk FINISHED_GOODS WIP**
  - Create order untuk FINISHED_GOODS WIP
  - Complete order
  - Generate journal
  - Check stock_movements:
    - OUT_PRODUCTION dari MAIN warehouse ✓
    - Quantity correct ✓

#### Finished Goods Output (IN_PRODUCTION)
- [ ] **Output product created untuk FINISHED_GOODS**
  - Create order untuk FINISHED_GOODS WIP dengan output_product_id set
  - Complete dengan actual quantities
  - Generate journal
  - Check stock_movements:
    - IN_PRODUCTION movement ada ✓
    - Product = output_product_id ✓
    - Quantity = batch_qty × yield_qty ✓
    - Warehouse = FINISHED_GOODS ✓

- [ ] **Output product NOT created untuk READY**
  - Create order dengan READY WIP
  - Complete & generate journal
  - Check stock_movements:
    - Hanya OUT_PRODUCTION ada ✓
    - NO IN_PRODUCTION movement ✓

#### Weighted Average Cost
- [ ] **avg_cost correctly calculated**
  - Start dengan stock qty=100, avg_cost=1000
  - Material use qty=50
  - Generate journal
  - Check balance:
    - New qty = 50 ✓
    - avg_cost = 1000 (retained, NOT reset to 0) ✓

- [ ] **Weighted avg untuk output product**
  - Start dengan stock FINISHED_GOODS qty=0, avg_cost=0
  - Add output qty=50, cost=5000
  - Check balance:
    - New qty = 50
    - New avg_cost = 5000/50 = 100 ✓

### 🟡 EDGE CASE TESTS

#### Validation & Error Handling
- [ ] **Partial PATCH update handling**
  - Send PATCH dengan hanya ubah `wip_name` (tanpa `output_product_id`)
  - Request should succeed (tidak trigger validation karena tidak mengubah warehouse)

- [ ] **Update to FINISHED_GOODS without product**
  - Send PATCH dengan `output_warehouse: 'FINISHED_GOODS'` tapi tanpa `output_product_id`
  - Should get validation error ✓

- [ ] **Stock insufficient**
  - Create order dengan material qty lebih dari available stock
  - Complete order
  - Should get error: "Stok tidak cukup" ✓

- [ ] **Products dropdown loading**
  - Open WIP form
  - Select FINISHED_GOODS
  - Product dropdown should show "Memuat produk..." saat loading
  - Dropdown disabled while loading
  - Options appear setelah products loaded

#### Data Consistency
- [ ] **Void order reverses movements**
  - Create & complete order
  - Generate journal
  - Void order
  - Check stock_movements:
    - Movement ada tapi di-reverse
    - Stock balance kembali ke original

- [ ] **Multiple orders same branch**
  - Create 2 orders di same branch, different WIP types
  - Both should process correctly
  - Stock balances accurate untuk each warehouse

### 🔴 CRITICAL PATH TEST (End-to-End)

**Test Scenario: Central Kitchen Production**

1. ✅ Create WIP (Chicken Katsu dengan output_warehouse=FINISHED_GOODS, output_product_id=finished_chicken_product)
2. ✅ Create production order untuk branch "Central Kitchen"
3. ✅ Add line: Chicken Katsu WIP, 10 batches
4. ✅ Create order → Detail page shows purple "→ Finished Goods" badge
5. ✅ Complete order: 10 batches × 2.5kg yield = 25kg finished goods
6. ✅ Generate journal
7. ✅ Verify stock movements:
   - OUT_PRODUCTION: 5kg chicken breast dari MAIN warehouse (for 10 batches × 0.5kg)
   - IN_PRODUCTION: 25kg finished chicken products ke FINISHED_GOODS warehouse
8. ✅ Check stock balances:
   - MAIN warehouse: qty-5, avg_cost retained
   - FINISHED_GOODS warehouse: qty+25, avg_cost updated dengan weighted average
9. ✅ Journal entries created correctly

---

## Test Environment Setup

### Prerequisites
```bash
# 1. Run migrations
npm run seed  # atau manual SQL execution

# 2. Start backend
npm run dev:backend

# 3. Start frontend
npm run dev:frontend

# 4. Login sebagai user dengan permission untuk:
- food_production.view
- food_production.create
- food_production.complete
- inventory.manage
```

### Test Data Setup
```sql
-- Create test WIPs (jalankan sebelum testing)
INSERT INTO wip_items (
  id, company_id, wip_code, wip_name, uom, yield_qty, 
  output_warehouse, output_product_id, 
  estimated_cost, cost_per_unit, notes, is_active, is_deleted, created_at, updated_at, created_by, updated_by
) VALUES
('ready-wip-id', '{company_id}', 'WIP-READY-01', 'Test Ready WIP', 'kg', 1, 'READY', NULL, 0, 0, NULL, true, false, NOW(), NOW(), '{user_id}', '{user_id}'),
('fg-wip-id', '{company_id}', 'WIP-FG-01', 'Test FG WIP', 'kg', 1, 'FINISHED_GOODS', '{product_id}', 0, 0, NULL, true, false, NOW(), NOW(), '{user_id}', '{user_id}');
```

---

## Test Results Reporting

### Pass Criteria
✅ **Feature considered COMPLETE when**:
- [ ] All smoke tests pass
- [ ] All stock movement tests pass (especially avg_cost retention)
- [ ] All edge cases handled gracefully
- [ ] Critical path end-to-end test succeeds
- [ ] No console errors or warnings
- [ ] UI loading states work correctly
- [ ] Validation messages display properly

### Known Limitations
- None identified yet (subject to testing)

---

## Rollback Plan

Jika ada critical issue:

```bash
# Revert database
psql -U postgres -d suryamas < rollback_migrations.sql

# Or remove columns
ALTER TABLE wip_items DROP COLUMN output_warehouse;
ALTER TABLE wip_items DROP COLUMN output_product_id;
ALTER TABLE warehouses DROP CONSTRAINT warehouses_warehouse_type_check;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_warehouse_type_check 
  CHECK (warehouse_type IN ('MAIN', 'READY', 'CENTRAL_STOCK', 'CENTRAL_KITCHEN'));

# Revert code
git checkout HEAD -- backend/src/
git checkout HEAD -- frontend/src/
```

---

## Files Changed Summary

### Backend (7 files)
1. `backend/database/migrations/20260602_add_output_warehouse_to_wip_items.sql`
2. `backend/database/migrations/20260602_add_finished_goods_warehouse_type.sql`
3. `backend/src/modules/food-production/wip/wip.schema.ts`
4. `backend/src/modules/food-production/wip/wip.types.ts`
5. `backend/src/modules/food-production/production-orders/production-orders.service.ts`
6. `backend/src/modules/food-production/production-orders/production-orders.repository.ts`
7. `backend/src/modules/food-production/wip/wip.repository.ts` (bug fix)

### Frontend (5 files)
1. `frontend/src/features/food-production/types/food-production.types.ts`
2. `frontend/src/features/food-production/api/food-production.api.ts`
3. `frontend/src/features/food-production/pages/WipDetailPage.tsx`
4. `frontend/src/features/food-production/pages/ProductionOrderForm.tsx`
5. `frontend/src/features/food-production/pages/ProductionOrderDetailPage.tsx`

---

## Support & Questions

**For issues during testing, check**:
1. Are migrations applied? (`\dt` di psql → check columns exist)
2. Is backend restarted after schema changes?
3. Is frontend cache cleared? (Ctrl+Shift+Delete in browser)
4. Check browser console untuk errors
5. Check server logs (`npm run dev` output)

**Common issues**:
- Products dropdown empty → check useProductList() returns data
- Validation error on save → check output_product_id filled kalau FINISHED_GOODS
- Stock not updating → check journal generated successfully
- avg_cost showing 0 → old code, refresh backend

---

## Next Steps After Testing

1. Deploy migrations to production
2. Deploy backend code
3. Deploy frontend code
4. Monitor logs untuk errors
5. User training: explain READY vs FINISHED_GOODS workflow
6. Documentation update: Standard Operating Procedures untuk central kitchen production

---
