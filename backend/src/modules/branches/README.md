# Branches Module

Branch management module for handling company branch locations and information.

## Features

- CRUD operations for branches
- Search and filtering by status, company, city, 24-hour operation
- Bulk status updates
- Permission-based access control
- Audit logging

## API Endpoints

### List Branches
```http
GET /api/v1/branches?page=1&limit=10&sort.field=branch_name&sort.order=asc&filter[status]=active&filter[company_id]=uuid&filter[city]=Jakarta&filter[is_24_jam]=true
Authorization: Bearer <token>
```

### Search Branches
```http
GET /api/v1/branches/search?q=branch_name&page=1&limit=10
Authorization: Bearer <token>
```

### Get Filter Options
```http
GET /api/v1/branches/filter-options
Authorization: Bearer <token>
```

### Get Branch by ID
```http
GET /api/v1/branches/:id
Authorization: Bearer <token>
```

### Create Branch
```http
POST /api/v1/branches
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_id": "uuid",
  "branch_code": "BRN001",
  "branch_name": "Jakarta Main",
  "address": "Jl. Sudirman No. 1",
  "city": "Jakarta",
  "province": "DKI Jakarta",
  "postal_code": "12190",
  "country": "Indonesia",
  "phone": "+62-21-1234567",
  "whatsapp": "+62-812-3456789",
  "email": "jakarta@company.com",
  "is_24_jam": true,
  "latitude": -6.2088,
  "longitude": 106.8456,
  "status": "active",
  "manager_id": "uuid",
  "notes": "Main branch"
}
```

### Update Branch
```http
PUT /api/v1/branches/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "branch_name": "Jakarta Main Updated",
  "status": "active",
  "phone": "+62-21-9876543"
}
```

### Delete Branch
```http
DELETE /api/v1/branches/:id
Authorization: Bearer <token>
```

### Bulk Update Status
```http
POST /api/v1/branches/bulk/update-status
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": ["uuid1", "uuid2"],
  "status": "inactive"
}
```

## Database Schema

```sql
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_code VARCHAR(20) NOT NULL UNIQUE,
  branch_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'closed')),
  manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100) DEFAULT 'DKI Jakarta',
  postal_code VARCHAR(10),
  country VARCHAR(100) DEFAULT 'Indonesia',
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(100),
  is_24_jam BOOLEAN DEFAULT false,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Recommended Indexes

```sql
CREATE UNIQUE INDEX idx_branches_code ON public.branches(branch_code);
CREATE INDEX idx_branches_company_id ON public.branches(company_id);
CREATE INDEX idx_branches_status ON public.branches(status);
CREATE INDEX idx_branches_city ON public.branches(city);
CREATE INDEX idx_branches_is_24_jam ON public.branches(is_24_jam);
```

## Validation Rules

- **branch_code**: Unique, required, max 20 characters
- **branch_name**: Required, max 100 characters
- **address**: Required, text
- **city**: Required, max 100 characters
- **province**: Default 'DKI Jakarta' if not provided
- **country**: Default 'Indonesia' if not provided
- **status**: Must be one of: active, inactive, maintenance, closed
- **email**: Valid email format if provided
- **phone/whatsapp**: Format /^[0-9+\-\s()]{6,20}$/
- **latitude**: Range -90 to 90
- **longitude**: Range -180 to 180

## Permissions

Module requires the following permissions:
- `view`: Read branches
- `insert`: Create branches
- `update`: Update branches and bulk status updates
- `delete`: Delete branches

## Business Rules

- branch_code is immutable after creation
- Deleting a branch with references will fail with "Branch is referenced and cannot be deleted"
- updated_at is automatically set by database
- Default status is 'active'
- Default is_24_jam is false
