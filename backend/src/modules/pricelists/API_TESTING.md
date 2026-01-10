# Pricelists API Testing Examples

## Setup
```bash
# Set your auth token
export TOKEN="your_jwt_token_here"
export BRANCH_ID="your_branch_id_here"
export BASE_URL="http://localhost:3000/api/v1"
```

## 1. Create Pricelist (DRAFT)

```bash
curl -X POST "$BASE_URL/pricelists" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Branch-ID: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "123e4567-e89b-12d3-a456-426614174000",
    "branch_id": null,
    "supplier_id": "123e4567-e89b-12d3-a456-426614174001",
    "product_id": "123e4567-e89b-12d3-a456-426614174002",
    "uom_id": "123e4567-e89b-12d3-a456-426614174003",
    "price": 150000,
    "currency": "IDR",
    "valid_from": "2026-01-01",
    "valid_to": "2026-12-31",
    "is_active": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Pricelist created successfully",
  "data": {
    "id": "uuid",
    "status": "DRAFT",
    "price": 150000,
    "currency": "IDR",
    "valid_from": "2026-01-01",
    "valid_to": "2026-12-31",
    "is_active": true,
    "created_at": "2026-01-10T08:00:00Z"
  }
}
```

---

## 2. List Pricelists (with filters)

```bash
# Basic list
curl "$BASE_URL/pricelists?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Filter by supplier
curl "$BASE_URL/pricelists?supplier_id=123e4567-e89b-12d3-a456-426614174001" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl "$BASE_URL/pricelists?status=APPROVED" \
  -H "Authorization: Bearer $TOKEN"

# Filter by active
curl "$BASE_URL/pricelists?is_active=true" \
  -H "Authorization: Bearer $TOKEN"

# Combined filters + sorting
curl "$BASE_URL/pricelists?supplier_id=uuid&status=APPROVED&sort_by=created_at&sort_order=desc" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Pricelists retrieved successfully",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 3. Get Pricelist by ID

```bash
curl "$BASE_URL/pricelists/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Pricelist retrieved successfully",
  "data": {
    "id": "uuid",
    "company_id": "uuid",
    "supplier_id": "uuid",
    "supplier_name": "PT Supplier ABC",
    "product_id": "uuid",
    "product_name": "Product XYZ",
    "uom_id": "uuid",
    "uom_name": "PCS",
    "price": 150000,
    "currency": "IDR",
    "valid_from": "2026-01-01",
    "valid_to": "2026-12-31",
    "status": "DRAFT",
    "is_active": true,
    "approved_by": null,
    "approved_at": null,
    "created_at": "2026-01-10T08:00:00Z"
  }
}
```

---

## 4. Update Pricelist (DRAFT only)

```bash
curl -X PUT "$BASE_URL/pricelists/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Branch-ID: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 160000,
    "valid_to": "2026-12-31"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Pricelist updated successfully",
  "data": {
    "id": "uuid",
    "price": 160000,
    "valid_to": "2026-12-31",
    "updated_at": "2026-01-10T09:00:00Z"
  }
}
```

**Error if not DRAFT:**
```json
{
  "success": false,
  "error": "Only DRAFT pricelists can be approved or rejected"
}
```

---

## 5. Approve Pricelist

```bash
curl -X POST "$BASE_URL/pricelists/123e4567-e89b-12d3-a456-426614174000/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Branch-ID: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Pricelist approved successfully",
  "data": {
    "id": "uuid",
    "status": "APPROVED",
    "approved_by": "employee_uuid",
    "approved_at": "2026-01-10T10:00:00Z"
  }
}
```

---

## 6. Reject Pricelist

```bash
curl -X POST "$BASE_URL/pricelists/123e4567-e89b-12d3-a456-426614174000/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Branch-ID: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "REJECTED"
  }'
```

---

## 7. Lookup Price (for PO)

```bash
# Lookup price for today
curl "$BASE_URL/pricelists/lookup?supplier_id=uuid&product_id=uuid&uom_id=uuid" \
  -H "Authorization: Bearer $TOKEN"

# Lookup price for specific date
curl "$BASE_URL/pricelists/lookup?supplier_id=uuid&product_id=uuid&uom_id=uuid&date=2026-06-15" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (found):**
```json
{
  "success": true,
  "message": "Price found successfully",
  "data": {
    "id": "uuid",
    "supplier_id": "uuid",
    "product_id": "uuid",
    "uom_id": "uuid",
    "price": 150000,
    "currency": "IDR",
    "valid_from": "2026-01-01",
    "valid_to": "2026-12-31",
    "status": "APPROVED"
  }
}
```

**Expected Response (not found):**
```json
{
  "success": true,
  "message": "No active pricelist found",
  "data": null
}
```

---

## 8. Delete Pricelist (Soft Delete)

```bash
curl -X DELETE "$BASE_URL/pricelists/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Branch-ID: $BRANCH_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Pricelist deleted successfully",
  "data": null
}
```

---

## Error Scenarios

### 1. Duplicate Active Pricelist
```bash
# Try to create duplicate
curl -X POST "$BASE_URL/pricelists" \
  -H "Authorization: Bearer $TOKEN" \
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

**Expected Error:**
```json
{
  "success": false,
  "error": "Active pricelist already exists for this supplier, product, and UOM combination"
}
```

### 2. Invalid Date Range
```bash
curl -X POST "$BASE_URL/pricelists" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "uuid",
    "supplier_id": "uuid",
    "product_id": "uuid",
    "uom_id": "uuid",
    "price": 150000,
    "valid_from": "2026-12-31",
    "valid_to": "2026-01-01"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Validation failed",
  "validation_errors": [
    {
      "field": "body",
      "message": "valid_to must be greater than or equal to valid_from"
    }
  ]
}
```

### 3. Update Non-DRAFT Pricelist
```bash
curl -X PUT "$BASE_URL/pricelists/uuid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price": 160000}'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Only DRAFT pricelists can be approved or rejected"
}
```

### 4. Approve Non-DRAFT Pricelist
```bash
curl -X POST "$BASE_URL/pricelists/uuid/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Only DRAFT pricelists can be approved or rejected"
}
```

---

## Testing Workflow

### Complete Flow Test
```bash
# 1. Create pricelist (DRAFT)
PRICELIST_ID=$(curl -X POST "$BASE_URL/pricelists" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}' | jq -r '.data.id')

# 2. Update price
curl -X PUT "$BASE_URL/pricelists/$PRICELIST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price": 160000}'

# 3. Approve
curl -X POST "$BASE_URL/pricelists/$PRICELIST_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}'

# 4. Lookup price
curl "$BASE_URL/pricelists/lookup?supplier_id=uuid&product_id=uuid&uom_id=uuid" \
  -H "Authorization: Bearer $TOKEN"

# 5. Try to update (should fail)
curl -X PUT "$BASE_URL/pricelists/$PRICELIST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price": 170000}'
```

---

## Notes

- Replace all `uuid` placeholders with actual UUIDs from your database
- Ensure you have proper permissions (view, insert, update, delete) for pricelists module
- Use `jq` for JSON parsing in bash scripts
- Check `/docs` endpoint for interactive Swagger UI testing
