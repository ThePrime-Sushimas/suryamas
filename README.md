# Suryamas - Finance Management System

Full-stack application dengan Express.js + React + TypeScript + Supabase

## Project Structure

```
suryamas/
├── backend/          # Express.js + TypeScript + Supabase
├── frontend/         # React + TypeScript + Vite + TailwindCSS
└── README.md
```

## Quick Start

### 1. Install All Dependencies
```bash
npm run install:all
```

### 2. Setup Environment Variables

**Backend** (`backend/.env`):
```env
PORT=3000
SUPABASE_URL=https://kxymzveitlrsyzjakzjl.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
JWT_SECRET=your_jwt_secret
NODE_ENV=development
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Run Development Servers

**Run Both (Backend + Frontend):**
```bash
npm run dev
```

**Or Run Separately:**
```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

## Access

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **API Docs**: http://localhost:3000/api

## Tech Stack

### Backend
- Express.js
- TypeScript
- Supabase (Auth + Database)
- Winston (Logging)
- JWT Authentication

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- React Router
- Zustand (State Management)
- Axios

## API Documentation

Base URL: `http://localhost:3000/api/v1`

### Authentication Required
Most endpoints require authentication. Include JWT token in header:
```
Authorization: Bearer <your_token>
```

---

## 📌 Auth Module

### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "employee_id": "EMP001"
}
```

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

### Forgot Password
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Reset Password
```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "password": "newpassword123"
}
```

---

## 👥 Employees Module

### List Employees (with pagination)
```http
GET /api/v1/employees?page=1&limit=10&sortBy=full_name&sortOrder=asc
Authorization: Bearer <token>
```

### Search Employees
```http
GET /api/v1/employees/search?q=john&page=1&limit=10
Authorization: Bearer <token>
```

### Autocomplete
```http
GET /api/v1/employees/autocomplete?q=john
Authorization: Bearer <token>
```

### Get Filter Options
```http
GET /api/v1/employees/filter-options
Authorization: Bearer <token>
```

### Get Profile (Current User)
```http
GET /api/v1/employees/profile
Authorization: Bearer <token>
```

### Update Profile
```http
PUT /api/v1/employees/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "full_name": "John Doe",
  "mobile_phone": "08123456789",
  ...
}
```

### Upload Profile Picture
```http
POST /api/v1/employees/profile/picture
Authorization: Bearer <token>
Content-Type: multipart/form-data

picture: <file>
```

### Generate Export Token
```http
GET /api/v1/employees/export/token
Authorization: Bearer <token>
```

### Export Data (Excel)
```http
GET /api/v1/employees/export?format=xlsx&token=<export_token>
Authorization: Bearer <token>
```

### Preview Import
```http
POST /api/v1/employees/import/preview
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <excel_file>
```

### Import Data
```http
POST /api/v1/employees/import
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <excel_file>
```

### Bulk Update Active Status
```http
POST /api/v1/employees/bulk/update-active
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": ["id1", "id2"],
  "is_active": true
}
```

### Bulk Delete
```http
POST /api/v1/employees/bulk/delete
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": ["id1", "id2"]
}
```

### Create Employee
```http
POST /api/v1/employees
Authorization: Bearer <token>
Content-Type: multipart/form-data

full_name: John Doe
email: john@example.com
employee_id: EMP001
job_position: Developer
branch_name: Jakarta
profile_picture: <file> (optional)
...
```

### Get Employee by ID
```http
GET /api/v1/employees/:id
Authorization: Bearer <token>
```

### Delete Employee
```http
DELETE /api/v1/employees/:id
Authorization: Bearer <token>
```

---

## 🔐 Permissions Module (Admin Only)

### Get All Modules
```http
GET /api/v1/permissions/modules
Authorization: Bearer <token>
```

### Get Module by ID
```http
GET /api/v1/permissions/modules/:id
Authorization: Bearer <token>
```

### Create Module
```http
POST /api/v1/permissions/modules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "reports",
  "description": "Reports Module",
  "is_active": true
}
```

### Update Module
```http
PUT /api/v1/permissions/modules/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "reports",
  "description": "Updated description",
  "is_active": true
}
```

### Delete Module
```http
DELETE /api/v1/permissions/modules/:id
Authorization: Bearer <token>
```

### Get All Roles
```http
GET /api/v1/permissions/roles
Authorization: Bearer <token>
```

### Get Role by ID (with permissions)
```http
GET /api/v1/permissions/roles/:id
Authorization: Bearer <token>
```

### Create Role
```http
POST /api/v1/permissions/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "supervisor",
  "description": "Supervisor Role"
}
```

### Update Role
```http
PUT /api/v1/permissions/roles/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "supervisor",
  "description": "Updated description"
}
```

### Delete Role
```http
DELETE /api/v1/permissions/roles/:id
Authorization: Bearer <token>
```

### Get Role Permissions
```http
GET /api/v1/permissions/roles/:roleId/permissions
Authorization: Bearer <token>
```

### Update Role Permission for Module
```http
PUT /api/v1/permissions/roles/:roleId/permissions/:moduleId
Authorization: Bearer <token>
Content-Type: application/json

{
  "can_view": true,
  "can_insert": true,
  "can_update": true,
  "can_delete": false,
  "can_approve": false,
  "can_release": false
}
```

### Bulk Update Role Permissions
```http
PUT /api/v1/permissions/roles/:roleId/permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "permissions": [
    {
      "module_id": "uuid1",
      "can_view": true,
      "can_insert": true,
      ...
    }
  ]
}
```

### Seed Default Permissions
```http
POST /api/v1/permissions/seed-defaults
Authorization: Bearer <token>
```

---

## 👤 Users Module (Admin Only)

### Get All Users
```http
GET /api/v1/users
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "employee_id": "EMP001",
      "full_name": "John Doe",
      "email": "john@example.com",
      "branch": "Jakarta",
      "has_account": true,
      "role_id": "uuid",
      "role_name": "admin",
      "role_description": "System Administrator"
    }
  ]
}
```

### Get User Role
```http
GET /api/v1/users/:userId/role
Authorization: Bearer <token>
```

### Assign Role to User
```http
PUT /api/v1/users/:userId/role
Authorization: Bearer <token>
Content-Type: application/json

{
  "role_id": "role-uuid"
}
```

### Remove Role from User
```http
DELETE /api/v1/users/:userId/role
Authorization: Bearer <token>
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## Development

### Backend
```bash
cd backend
npm run dev
```

### Frontend
```bash
cd frontend
npm run dev
```

### Both
```bash
npm run dev
```

## Production Build

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
# Output: dist/
```

## Deployment

### Backend
- Railway ($5/month)
- Render (Free tier)
- AWS EC2

### Frontend
- Vercel (Free, unlimited)
- Netlify (Free, 100GB/month)
- Cloudflare Pages (Free, unlimited)

## Documentation

- Backend: `backend/src/modules/*/README.md`
- Frontend: `frontend/README.md`

## Scripts

```bash
# Install all dependencies
npm run install:all

# Run both backend + frontend
npm run dev

# Run backend only
npm run dev:backend

# Run frontend only
npm run dev:frontend
```

## License

ISC
