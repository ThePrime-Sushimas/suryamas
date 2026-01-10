# 🚀 PRICELISTS MODULE - QUICK REFERENCE

## 📦 Module Location
```
backend/src/modules/pricelists/
```

## 🔌 API Base URL
```
/api/v1/pricelists
```

## 🎯 Quick Commands

### Start Server
```bash
cd backend && npm run dev
```

### Run Migration
```bash
psql -d your_db -f backend/database/migrations/pricelists.sql
```

### Type Check
```bash
cd backend && npx tsc --noEmit
```

### Test Endpoint
```bash
curl http://localhost:3000/api/v1/pricelists \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📋 API Endpoints Cheat Sheet

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/pricelists` | Create | insert |
| GET | `/pricelists` | List | view |
| GET | `/pricelists/:id` | Detail | view |
| PUT | `/pricelists/:id` | Update | update |
| POST | `/pricelists/:id/approve` | Approve | update |
| DELETE | `/pricelists/:id` | Delete | delete |
| GET | `/pricelists/lookup` | Lookup | view |

---

## 🔑 Required Headers

```http
Authorization: Bearer <jwt_token>
X-Branch-ID: <branch_uuid>
Content-Type: application/json
```

---

## 📝 Create Pricelist (Minimal)

```json
{
  "company_id": "uuid",
  "supplier_id": "uuid",
  "product_id": "uuid",
  "uom_id": "uuid",
  "price": 150000,
  "valid_from": "2026-01-01"
}
```

---

## 🔍 Query Parameters

### List
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `supplier_id` (filter)
- `product_id` (filter)
- `status` (DRAFT|APPROVED|EXPIRED|REJECTED)
- `is_active` (true|false)
- `sort_by` (default: created_at)
- `sort_order` (asc|desc)

### Lookup
- `supplier_id` (required)
- `product_id` (required)
- `uom_id` (required)
- `date` (optional, default: today)

---

## 🎭 Status Flow

```
DRAFT → APPROVED → EXPIRED
  ↓
REJECTED
```

**Rules:**
- Only DRAFT can be updated
- Only DRAFT can be approved/rejected
- APPROVED auto-expires when valid_to < today

---

## ⚠️ Business Rules

1. **Anti-duplikasi:** 1 supplier + 1 product + 1 UOM = 1 active pricelist
2. **Date validation:** valid_to >= valid_from
3. **Immutability:** APPROVED cannot be updated
4. **Snapshot:** PO must copy price, not reference

---

## 🔧 Common Use Cases

### 1. Create & Approve
```typescript
// 1. Create
const pricelist = await pricelistsService.createPricelist({
  company_id: 'uuid',
  supplier_id: 'uuid',
  product_id: 'uuid',
  uom_id: 'uuid',
  price: 150000,
  valid_from: '2026-01-01'
}, userId)

// 2. Approve
await pricelistsService.approvePricelist(
  pricelist.id,
  { status: 'APPROVED' },
  userId
)
```

### 2. Lookup for PO
```typescript
const pricelist = await pricelistsService.lookupPrice({
  supplier_id: 'uuid',
  product_id: 'uuid',
  uom_id: 'uuid',
  date: '2026-06-15'
})

if (!pricelist) {
  throw new Error('No active pricelist')
}

// Snapshot to PO
const poItem = {
  unit_price: pricelist.price,
  currency: pricelist.currency,
  pricelist_id: pricelist.id
}
```

### 3. Auto-expire (Cron)
```typescript
// Run daily
const count = await pricelistsService.expireOldPricelists()
console.log(`Expired ${count} pricelists`)
```

---

## 🐛 Common Errors

| Code | Error | Solution |
|------|-------|----------|
| 401 | No token | Add Authorization header |
| 403 | No permission | Check user role permissions |
| 404 | Not found | Verify pricelist ID |
| 409 | Duplicate | Active pricelist exists |
| 422 | Validation | Check date range / status |

---

## 📚 Documentation Links

- **Module README:** `backend/src/modules/pricelists/README.md`
- **API Testing:** `backend/src/modules/pricelists/API_TESTING.md`
- **Implementation:** `PRICELISTS_IMPLEMENTATION.md`
- **Verification:** `PRICELISTS_VERIFICATION.md`
- **OpenAPI:** `http://localhost:3000/docs`

---

## 🎓 Integration Example (PO Module)

```typescript
import { pricelistsService } from '@/modules/pricelists'

async function createPurchaseOrder(poData) {
  // Lookup price for each item
  for (const item of poData.items) {
    const pricelist = await pricelistsService.lookupPrice({
      supplier_id: poData.supplier_id,
      product_id: item.product_id,
      uom_id: item.uom_id,
      date: poData.po_date
    })
    
    if (!pricelist) {
      throw new Error(`No price for ${item.product_id}`)
    }
    
    // Snapshot price
    item.unit_price = pricelist.price
    item.currency = pricelist.currency
    item.pricelist_id = pricelist.id
    item.subtotal = item.quantity * pricelist.price
  }
  
  // Create PO with snapshotted prices
  return await createPO(poData)
}
```

---

## 🔐 Permission Setup

```sql
-- Auto-registered on first API call
-- Module: 'pricelists'
-- Actions: view, insert, update, delete

-- Grant to role
INSERT INTO perm_role_permissions (role_id, module_id, can_view, can_insert, can_update, can_delete)
SELECT 
  'role_uuid',
  id,
  true, true, true, true
FROM perm_modules
WHERE module_name = 'pricelists';
```

---

## 💡 Tips & Best Practices

1. **Always snapshot price to PO** - Don't reference pricelist directly
2. **Create new pricelist for price changes** - Don't update APPROVED
3. **Use lookup endpoint for PO** - Handles date validation
4. **Run auto-expire daily** - Keep status accurate
5. **Set valid_to for temporary prices** - NULL = permanent

---

## 🎉 Quick Start (5 minutes)

```bash
# 1. Run migration
psql -d your_db -f backend/database/migrations/pricelists.sql

# 2. Start server
cd backend && npm run dev

# 3. Test health
curl http://localhost:3000/health

# 4. Check docs
open http://localhost:3000/docs

# 5. Create first pricelist
curl -X POST http://localhost:3000/api/v1/pricelists \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "uuid",
    "supplier_id": "uuid",
    "product_id": "uuid",
    "uom_id": "uuid",
    "price": 150000,
    "valid_from": "2026-01-01"
  }'
```

**Done! Module ready to use.** 🚀
