# Quick Test Checklist - Output Warehouse Feature

**Time to test**: ~30 minutes (smoke + critical path)  
**Full regression**: ~2 hours (including all edge cases)

---

## 🚀 QUICK SMOKE TEST (5 minutes)

### Setup
- [ ] Migrations applied (`psql -c "\d wip_items"` → confirm columns exist)
- [ ] Backend running (`npm run dev`)
- [ ] Frontend running (`npm run dev` di tab lain)
- [ ] Logged in dengan valid user

### Test
- [ ] Go to `/food-production/wip/new`
- [ ] Fill: code="TEST-1", name="Test WIP", ingredients (any)
- [ ] Output Warehouse = READY (default) → **Product selector NOT shown** ✓
- [ ] Save → Success ✓
- [ ] Change Output Warehouse → FINISHED_GOODS → **Product selector appears** ✓
- [ ] Select product → Save → Success ✓

**Result**: ✅ or ❌

---

## 🎯 CRITICAL PATH TEST (10 minutes)

### Setup
- Ensure test WIPs exist (READY + FINISHED_GOODS types)
- Ensure warehouses exist (READY, MAIN, FINISHED_GOODS)

### Test Flow
1. [ ] Create production order
2. [ ] Add READY WIP → see `[→ Ready]` badge
3. [ ] Add FINISHED_GOODS WIP → see `[→ FG]` badge
4. [ ] Create order → ✓
5. [ ] Open detail page → badges visible? ✓
6. [ ] Complete order (mark actual quantities)
7. [ ] Generate journal → ✓
8. [ ] Check stock movements exist
9. [ ] Check avg_cost NOT zero

**Result**: ✅ or ❌

---

## 📋 VALIDATION TEST (5 minutes)

### Test
- [ ] Try save WIP dengan FINISHED_GOODS tapi NO product → Error? ✓
- [ ] Error message clear? ✓
- [ ] Fix (add product) → Save again → Success? ✓

**Result**: ✅ or ❌

---

## 🔍 EDGE CASES (10 minutes)

### Loading States
- [ ] Open FINISHED_GOODS → dropdown says "Memuat produk..."? ✓
- [ ] Dropdown disabled while loading? ✓
- [ ] Becomes active after data loaded? ✓

### Data Persistence
- [ ] Edit WIP → change warehouse → save
- [ ] Refresh page → value persists? ✓

### Partial Updates
- [ ] Edit WIP → only change `wip_name` (not warehouse/product)
- [ ] Save → Success (validation NOT triggered on fields not sent)? ✓

**Result**: ✅ or ❌

---

## 📊 STOCK MOVEMENT (5 minutes)

### Critical Check
```sql
-- After completing production order, run:
SELECT movement_type, qty, warehouse_id, product_id, cost_per_unit 
FROM stock_movements 
WHERE reference_id = '{order_id}' 
ORDER BY created_at;

-- Check:
-- ✓ OUT_PRODUCTION exists (negative qty)
-- ✓ IN_PRODUCTION exists (positive qty) for FINISHED_GOODS
-- ✓ cost_per_unit > 0
-- ✓ correct warehouse_id

-- Check stock balance:
SELECT warehouse_id, product_id, qty, avg_cost 
FROM stock_balance 
WHERE warehouse_id IN (select id from warehouses where warehouse_type IN ('READY', 'MAIN', 'FINISHED_GOODS'))
ORDER BY updated_at DESC LIMIT 10;

-- Check:
-- ✓ qty updated correctly
-- ✓ avg_cost NOT zero (retained from before)
```

**Result**: ✅ or ❌

---

## ✅ SIGN-OFF

| Test | Result | Notes |
|------|--------|-------|
| Smoke Test | ✅/❌ | |
| Critical Path | ✅/❌ | |
| Validation | ✅/❌ | |
| Edge Cases | ✅/❌ | |
| Stock Movement | ✅/❌ | |

**Overall**: 🟢 PASS / 🔴 FAIL

**Tester**: ________________  
**Date**: ________________  
**Issues Found**: 
- 
- 

---

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Products dropdown empty | Refresh browser (cache issue) |
| Validation not triggering | Restart backend (schema changes need recompile) |
| avg_cost showing 0 | Check migrations applied, restart backend |
| Badges not showing | Clear frontend cache (Ctrl+Shift+Delete) |
| Cannot select product | Products list not loaded, check API response |

---

## Rollback (if needed)

```bash
# Stop both servers
# Ctrl+C di terminal

# Reset database
psql -U postgres -d suryamas -c "
ALTER TABLE wip_items DROP COLUMN output_warehouse;
ALTER TABLE wip_items DROP COLUMN output_product_id;
ALTER TABLE warehouses DROP CONSTRAINT warehouses_warehouse_type_check;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_warehouse_type_check 
  CHECK (warehouse_type IN ('MAIN', 'READY', 'CENTRAL_STOCK', 'CENTRAL_KITCHEN'));
"

# Revert code
git checkout HEAD -- backend/src/ frontend/src/

# Restart
npm run dev
```

---
