# Suppliers Module

Modul untuk mengelola data supplier dalam sistem ERP.

## Features

- ✅ Create supplier
- ✅ Update supplier  
- ✅ Soft delete supplier
- ✅ Get supplier by ID
- ✅ List suppliers with pagination, search, filter, sorting
- ✅ Dropdown list for active suppliers

## API Endpoints

```
POST   /api/v1/suppliers           - Create supplier
GET    /api/v1/suppliers           - List suppliers
GET    /api/v1/suppliers/:id       - Get supplier by ID
PUT    /api/v1/suppliers/:id       - Update supplier
DELETE /api/v1/suppliers/:id       - Soft delete supplier
GET    /api/v1/suppliers/options   - Get dropdown options
```

## Business Rules

- `supplier_code` unique untuk supplier yang tidak dihapus (deleted_at IS NULL)
- Tidak bisa hapus supplier yang sudah digunakan di procurement
- Default `is_active = true`
- `rating` opsional (1-5)
- `payment_term_id` opsional
- Soft delete = set `deleted_at` + `is_active = false`

## Validation

- `phone`: numeric, 10-15 karakter
- `email`: format email valid jika diisi
- `lead_time_days`: 0-365
- `minimum_order`: >= 0
- `rating`: 1-5
- `supplier_type`: harus sesuai dengan daftar yang diizinkan

## Supplier Types

- vegetables
- meat
- seafood
- dairy
- beverage
- dry_goods
- packaging
- other

## Database Schema

```sql
Table: suppliers
- id (PK, SERIAL/INTEGER)
- supplier_code (string, unique for non-deleted)
- supplier_name (string)
- supplier_type (enum-like string)
- contact_person (required)
- phone (required)
- email (optional)
- address (required)
- city (required)
- province (required)
- postal_code (optional)
- tax_id (optional)
- business_license (optional)
- payment_term_id (FK -> payment_terms.id)
- lead_time_days (0–365, default 1)
- minimum_order (>= 0, default 0)
- rating (INTEGER 1–5, optional)
- is_active (boolean, default true)
- notes (optional)
- created_by (FK -> employees.id)
- updated_by (FK -> employees.id)
- created_at
- updated_at
- deleted_at (soft delete)
```

## Usage Example

```typescript
// Create supplier
const supplier = await suppliersService.createSupplier({
  supplier_code: 'SUP001',
  supplier_name: 'Fresh Vegetables Co',
  supplier_type: 'vegetables',
  phone: '08123456789',
  email: 'contact@freshveg.com',
  is_active: true
}, userId)

// List suppliers with filters
const result = await suppliersService.getSuppliers({
  page: 1,
  limit: 10,
  search: 'fresh',
  supplier_type: 'vegetables',
  is_active: true,
  sort_by: 'supplier_name',
  sort_order: 'asc'
})
```