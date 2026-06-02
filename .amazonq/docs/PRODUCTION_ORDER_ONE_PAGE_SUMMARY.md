# Production Order - One Page Summary

> **TL;DR Version** - Read this in 5 minutes

---

## The System in 30 Seconds

**Production Order** = Daily recipe (WIP) production logger per branch.

```
Chef inputs:
  "Hari ini bikin 10 batch Chicken Katsu"
  
System tracks:
  ✅ Planned: 10 batches, 50 kg ayam, Rp 450k cost
  ✅ Actual: 9 batches (1 failed), 9.5kg ayam, Rp 475k cost
  ✅ Waste: 0.3kg trim, Rp 15k waste cost
  ✅ Journal: Auto-generate GL entry (Bahan → WIP)
  ✅ Undo: Can void + reverse journal if mistake
```

---

## Your 5 Questions Answered

| # | Question | Answer | Status |
|---|----------|--------|--------|
| **1** | WIP position filter? | ✅ `filter_by_position=true` filters by user's role | DONE |
| **2** | What happens on "Buat Order"? | ✅ Transaction: snapshot WIP, recipe, costs → safe | DONE |
| **3** | Planned vs Actual vs Waste? | ✅ Tracked per-material, calc'd on complete | DONE |
| **4** | Stock auto-deduct? | ⏳ Journal only, stock movement = MANUAL (gap) | 60% |
| **5** | Void & undo? | ✅ Backend done, UI buttons missing (easy fix) | 90% |

---

## Current State

```
ARCHITECTURE READY     ✅
├─ Position filtering  ✅
├─ Order creation      ✅
├─ Actual tracking     ✅
├─ Journal generation  ✅
├─ Void + reversal     ✅ (backend only)
└─ Stock integration   ⏳ (NEXT SPRINT)

FRONTEND READY        70%
├─ Create form        ✅
├─ Detail page        ✅
├─ Void buttons       ❌ (2-3 hours to add)
└─ Stock UI           ❌ (future)

GAPS                  30%
├─ Stock movements    ⏳ (auto OUT/IN)
├─ Finished goods     ⏳ (batch tracking)
├─ Amendment orders   ⏳ (redo flow)
└─ POS integration    ⏳ (auto-deduct)
```

---

## Quick Reference

### Status Workflow
```
DRAFT → COMPLETED → JOURNALED → VOID
 (new)   (inputs actual)  (GL entry)  (reverse)
```

### Key Files
```
Backend:
  /backend/src/modules/food-production/production-orders/
  /backend/src/modules/food-production/wip/

Frontend:
  /frontend/src/features/food-production/pages/
  /frontend/src/features/food-production/api/
```

### API Endpoints (Ready)
```
POST   /production-orders              ✅
POST   /production-orders/{id}/complete         ✅
POST   /production-orders/{id}/void             ✅
POST   /production-orders/{id}/generate-journal ✅
```

---

## Real Example: 2 Juni 2025, Kitchen Condet

```
09:00  Chef creates order: 10 Chicken Katsu batches
       ├─ Position filter shows: Katsu ✅, Sushi ❌
       ├─ Order created: PRD-CDT-20250602-001 (DRAFT)
       └─ Snapshot: Recipes, costs, ingredients frozen

09:30  Chef completes production: 9 batches successful
       ├─ Inputs: actual_qty, waste_qty, waste_reason
       ├─ System calcs: Rp 687.5k cost, Rp 29.5k waste
       └─ Status → COMPLETED

10:00  Accountant generates journal
       ├─ Creates GL entry: WIP ← Raw Materials
       ├─ Includes: Waste account (Rp 29.5k)
       └─ Status → JOURNALED

11:00  ERROR FOUND: Wrong recipe used!
       ├─ Accountant clicks: "Void & Reverse"
       ├─ System auto-creates: Reversal journal
       ├─ Marks original: is_reversed = true
       └─ Status → VOID
```

---

## What's Done Right Now

### ✅ Can Do Today (No Code)
- Create production orders with position filter
- Complete orders, track actual vs planned
- Generate GL entries automatically
- Manual void (if using API directly)

### ✅ Can Add This Week (Frontend Only)
- Void buttons for DRAFT/COMPLETED/JOURNALED
- Show void reason + audit trail
- Confirmation dialogs
- UI improvements

**Time**: 2-3 hours (copy-paste ready code in docs)

### ⏳ Coming Later (Medium Priority)
- Auto stock movement (OUT_PRODUCTION / IN_PRODUCTION)
- Finished goods tracking
- Amendment order flow
- POS integration

**Time**: 1-2 weeks each

---

## Your Action Items

### THIS WEEK
- [ ] Read: VOID_IMPLEMENTATION_GUIDE.md
- [ ] Copy: Frontend component code
- [ ] Add: Void buttons to ProductionOrderDetailPage
- [ ] Test: All 3 void scenarios
- [ ] Verify: GL reversal works

**Effort**: 3-5 hours  
**Value**: Unlock undo functionality for all users

### NEXT WEEK
- [ ] Stock movement integration
- [ ] Amendment order flow
- [ ] Production → Stock reconciliation

**Effort**: 3-5 days  
**Value**: Real-time inventory sync

---

## Documentation Map

```
START HERE:
  └─ PRODUCTION_ORDER_README.md (this quick guide)
     
THEN DIVE INTO:
  ├─ VOID_IMPLEMENTATION_GUIDE.md (if coding today)
  ├─ PRODUCTION_ORDER_IMPLEMENTATION_GUIDE.md (if understanding)
  └─ PRODUCTION_ORDER_ACTION_ITEMS.md (if planning)

FOR DETAILS:
  └─ PRODUCTION_ORDER_DESIGN.md (original spec)
```

---

## Key Stats

```
Lines of Code (Backend):     ~2000 (done)
Lines of Code (Frontend):    ~500 (partial)
Tables Involved:             5 (production_orders, lines, materials, journals, wip)
API Endpoints:               4 (all implemented)
Features Complete:           70%
Ready for Production:        ✅ (for non-stock parts)
```

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Stock out of sync | HIGH | Implement auto-movements (next sprint) |
| Lost audit trail | HIGH | Soft-delete + journal reversal (done) |
| Incorrect GL | MEDIUM | Validate COA + fiscal period (done) |
| User confusion | LOW | Add UI buttons + clear status (easy) |

---

## Success Criteria

When fully done ✓:
- Chef can create → complete → void production orders
- Accountant can generate GL + reverse if needed
- Stock auto-deducts from READY warehouse
- Finished goods tracked by batch
- Waste analysis available per production
- Audit trail shows all changes

---

## Need More Info?

| Question | Answer Location |
|----------|-----------------|
| How do I implement void? | VOID_IMPLEMENTATION_GUIDE.md |
| How does position filter work? | IMPLEMENTATION_GUIDE.md → Q1 |
| What's the real-world flow? | IMPLEMENTATION_GUIDE.md → Q2 |
| How are costs calculated? | IMPLEMENTATION_GUIDE.md → Q3 |
| Where are the stock gaps? | IMPLEMENTATION_GUIDE.md → Q4 |
| How does journal reversal work? | IMPLEMENTATION_GUIDE.md → Q5 |
| What's the priority? | ACTION_ITEMS.md → Immediate Items |
| How do I test? | VOID_GUIDE.md → Testing Guide |
| It's broken, help! | VOID_GUIDE.md → Troubleshooting |

---

## Bottom Line

**Status**: 70% done, fully functional for core use case ✅

**Next Move**: Add void buttons (2-3 hours) to unlock undo ✨

**Long Term**: Stock integration (1-2 weeks) for full automation 🚀

---

**Read**: [VOID_IMPLEMENTATION_GUIDE.md](./VOID_IMPLEMENTATION_GUIDE.md) next if you're implementing today
