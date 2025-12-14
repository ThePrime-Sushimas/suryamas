# Companies Module

Company management module dengan fitur CRUD, export/import, dan permission-based access control.

## Endpoints

### List Companies
```http
GET /api/v1/companies?page=1&limit=10&sortBy=company_name&sortOrder=asc
Authorization: Bearer <token>
```

### Search Companies
```http
GET /api/v1/companies/search?q=PT&page=1&limit=10&status=active&company_type=PT
Authorization: Bearer <token>
```

### Get Filter Options
```http
GET /api/v1/companies/filter-options
Authorization: Bearer <token>
```

### Get Company by ID
```http
GET /api/v1/companies/:id
Authorization: Bearer <token>
```

### Create Company
```http
POST /api/v1/companies
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_code": "PT001",
  "company_name": "PT Maju Jaya",
  "company_type": "PT",
  "npwp": "12345678901234",
  "email": "info@majujaya.com",
  "phone": "021-1234567",
  "website": "https://majujaya.com",
  "status": "active"
}
```

### Update Company
```http
PUT /api/v1/companies/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_name": "PT Maju Jaya Baru",
  "status": "active"
}
```

Note: `company_code` is immutable after creation.

### Delete Company
```http
DELETE /api/v1/companies/:id
Authorization: Bearer <token>
```

### Bulk Update Status
```http
POST /api/v1/companies/bulk/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": ["id1", "id2"],
  "status": "inactive"
}
```

### Bulk Delete
```http
POST /api/v1/companies/bulk/delete
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": ["id1", "id2"]
}
```

### Export Companies
```http
GET /api/v1/companies/export/token
Authorization: Bearer <token>

GET /api/v1/companies/export?format=xlsx&token=<export_token>&status=active
Authorization: Bearer <token>
```

### Import Companies
```http
POST /api/v1/companies/import/preview
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <excel_file>

POST /api/v1/companies/import?skipDuplicates=true
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <excel_file>
```

## Data Model

### Company
- `id` (uuid, primary key)
- `company_code` (varchar, unique, required)
- `company_name` (varchar, required)
- `company_type` (varchar, default: 'PT') - PT, CV, Firma, Koperasi, Yayasan
- `npwp` (varchar, unique, nullable)
- `website` (varchar, nullable)
- `email` (varchar, nullable)
- `phone` (varchar, nullable)
- `status` (varchar, default: 'active') - active, inactive, suspended, closed
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Validation Rules

- `company_code`: Required, unique, max 20 chars
- `company_name`: Required, max 200 chars
- `company_type`: Must be one of: PT, CV, Firma, Koperasi, Yayasan
- `npwp`: Unique if provided, max 20 chars
- `email`: Valid email format
- `phone`: Numeric or dashed format
- `website`: Valid URL format
- `status`: Must be one of: active, inactive, suspended, closed

## Business Rules

1. `company_code` is immutable after creation
2. `npwp` must be unique across all companies
3. `updated_at` is automatically updated on modifications
4. Soft delete is not implemented (hard delete only)
5. No foreign key constraints (can be added if needed)

## Permissions

Module name: `companies`

Required permissions:
- `canView`: View companies
- `canInsert`: Create companies
- `canUpdate`: Update companies
- `canDelete`: Delete companies

## Import/Export

### Export Columns
- company_code
- company_name
- company_type
- npwp
- email
- phone
- website
- status
- created_at
- updated_at

### Import Requirements
- Required fields: company_code, company_name
- Optional fields: company_type, npwp, email, phone, website, status
- `skipDuplicates` flag: Skip records with duplicate company_code or npwp

## Architecture

- **Controller**: Request handling and response formatting
- **Service**: Business logic and validation
- **Repository**: Database operations via Supabase
- **Types**: TypeScript interfaces and DTOs
