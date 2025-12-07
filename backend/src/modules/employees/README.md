# Employees Module

Employee management module untuk Suryamas Finance Management System.

## Overview

Module ini menangani CRUD operations untuk employee data, termasuk profile management, search, dan autocomplete.

## Structure

```
employees/
├── employees.controller.ts   # Request handlers
├── employees.service.ts      # Business logic
├── employees.repository.ts   # Database access
├── employees.routes.ts       # Route definitions
└── README.md                # Documentation
```

## Architecture

```
Controller → Service → Repository → Supabase
```

- **Controller**: Handle HTTP requests/responses
- **Service**: Business logic & validation
- **Repository**: Database queries

---

## Endpoints

### Search Endpoints

#### 1. Search Employees
```http
GET /api/employees/search?q=<query>
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `q` (string): Search term

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employee_id": "EMP001",
      "full_name": "John Doe",
      "job_position": "Developer",
      "branch_name": "Jakarta",
      ...
    }
  ]
}
```

**Features:**
- Full-text search on `full_name`
- Support websearch syntax: "John Doe", "John OR Doe"
- Max 20 results

---

#### 2. Autocomplete
```http
GET /api/employees/autocomplete?q=<query>
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `q` (string): Search query

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "full_name": "John Doe"
    }
  ]
}
```

**Features:**
- ILIKE search (case-insensitive)
- Returns only `id` and `full_name`
- Max 10 results
- Optimized for dropdown/select inputs

---

### CRUD Endpoints

#### 3. Create Employee
```http
POST /api/employees
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "employee_id": "EMP001",
  "full_name": "John Doe",
  "job_position": "Developer",
  "branch_name": "Jakarta",
  "ptkp_status": "TK/0",
  "status_employee": "Permanent",
  "join_date": "2024-01-01",
  "religion": "Islam",
  "gender": "Male",
  "marital_status": "Single"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employee_id": "EMP001",
    "full_name": "John Doe",
    ...
  },
  "message": "Employee created"
}
```

**Required Fields:**
- `employee_id`
- `full_name`
- `job_position`
- `branch_name`
- `ptkp_status`
- `status_employee`
- `join_date`

---

#### 4. Delete Employee
```http
DELETE /api/employees/:id
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Employee deleted"
}
```

---

### Profile Endpoints

#### 5. Get Profile
```http
GET /api/employees/profile
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employee_id": "EMP001",
    "full_name": "John Doe",
    "job_position": "Developer",
    "email": "john@example.com",
    "mobile_phone": "081234567890",
    ...
  }
}
```

**Notes:**
- Returns employee data linked to authenticated user
- Uses `user_id` from JWT token

---

#### 6. Update Profile
```http
PUT /api/employees/profile
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "mobile_phone": "081234567890",
  "bank_name": "BCA",
  "bank_account": "1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employee_id": "EMP001",
    "email": "newemail@example.com",
    "mobile_phone": "081234567890",
    ...
  },
  "message": "Profile updated"
}
```

**Protected Fields (Cannot Update):**
- `id`
- `employee_id`
- `user_id`
- `created_at`

---

## Business Logic

### Service Layer

#### create()
- Validate required fields
- Insert employee data
- Return created employee

#### search()
- Full-text search by name
- Return max 20 results

#### autocomplete()
- Case-insensitive partial match
- Return minimal data (id, name)
- Max 10 results

#### getProfile()
- Find employee by `user_id`
- Throw error if not found

#### updateProfile()
- Filter protected fields
- Validate at least 1 field to update
- Update and return employee

#### delete()
- Delete employee by `id`

---

### Repository Layer

#### create()
```typescript
async create(data: Partial<Employee>): Promise<Employee | null>
```

#### findByUserId()
```typescript
async findByUserId(userId: string): Promise<Employee | null>
```

#### findByEmail()
```typescript
async findByEmail(email: string): Promise<Employee | null>
```

#### searchByName()
```typescript
async searchByName(searchTerm: string): Promise<Employee[]>
```
- Uses Supabase `textSearch()` with websearch type

#### autocompleteName()
```typescript
async autocompleteName(query: string): Promise<{id: string, full_name: string}[]>
```
- Uses Supabase `ilike()` for case-insensitive search

#### update()
```typescript
async update(userId: string, updates: Partial<Employee>): Promise<Employee | null>
```

#### delete()
```typescript
async delete(id: string): Promise<void>
```

---

## Logging

Module ini menggunakan Winston untuk logging:

### Info Logs
- Employee created
- Profile updated
- Employee deleted

### Error Logs
- Failed to create employee
- Failed to search employees
- Failed to autocomplete employees
- Failed to get profile
- Failed to update profile
- Failed to delete employee

**Log Format:**
```json
{
  "timestamp": "2025-12-07 23:51:30",
  "level": "info",
  "message": "Employee created",
  "employee_id": "EMP001",
  "user": "uuid"
}
```

---

## Data Types

### Employee Interface
```typescript
interface Employee {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  join_date: string
  resign_date: string | null
  status_employee: 'Permanent' | 'Contract'
  end_date: string | null
  sign_date: string | null
  email: string | null
  birth_date: string | null
  age: string | null
  birth_place: string | null
  citizen_id_address: string | null
  ptkp_status: 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3'
  bank_name: string | null
  bank_account: string | null
  bank_account_holder: string | null
  nik: string | null
  mobile_phone: string | null
  branch_name: string
  parent_branch_name: string | null
  religion: 'Islam' | 'Christian' | 'Catholic' | 'Hindu' | 'Buddha' | 'Other' | null
  gender: 'Male' | 'Female' | null
  marital_status: 'Single' | 'Married' | 'Divorced' | 'Widow' | null
  profile_picture: boolean
  created_at: string
  updated_at: string
  user_id: string | null
}
```

---

## Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "error": "No valid fields to update"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Employee profile not found"
}
```

---

## Dependencies

- **Supabase Database**: Employee data storage
- **Winston**: Logging
- **Auth Middleware**: Token verification (all routes protected)

---

## Testing

### Create Employee
```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "EMP001",
    "full_name": "John Doe",
    "job_position": "Developer",
    "branch_name": "Jakarta",
    "ptkp_status": "TK/0",
    "status_employee": "Permanent",
    "join_date": "2024-01-01"
  }'
```

### Search
```bash
curl -X GET "http://localhost:3000/api/employees/search?q=John" \
  -H "Authorization: Bearer <token>"
```

### Autocomplete
```bash
curl -X GET "http://localhost:3000/api/employees/autocomplete?q=Joh" \
  -H "Authorization: Bearer <token>"
```

### Get Profile
```bash
curl -X GET http://localhost:3000/api/employees/profile \
  -H "Authorization: Bearer <token>"
```

### Update Profile
```bash
curl -X PUT http://localhost:3000/api/employees/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","mobile_phone":"081234567890"}'
```

### Delete Employee
```bash
curl -X DELETE http://localhost:3000/api/employees/<id> \
  -H "Authorization: Bearer <token>"
```

---

## Performance Considerations

### Search Optimization
- Full-text search limited to 20 results
- Autocomplete limited to 10 results
- Uses database indexes on `full_name`

### Query Optimization
- `maybeSingle()` for single record queries
- `select()` only needed columns for autocomplete
- Avoid N+1 queries with proper data fetching

---

## Security

- All endpoints require authentication
- Protected fields cannot be updated via API
- User can only access their own profile
- Admin can create/delete any employee
