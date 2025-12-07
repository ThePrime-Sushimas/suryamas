# Auth Module

Authentication module untuk Suryamas Finance Management System.

## Overview

Module ini menangani autentikasi user menggunakan Supabase Auth dan menghubungkan dengan data employee.

## Structure

```
auth/
├── auth.controller.ts  # Request handlers
├── auth.routes.ts      # Route definitions
└── README.md          # Documentation
```

## Endpoints

### Public Routes

#### 1. Register
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "employee_id": "EMP001"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      ...
    },
    "employee": "John Doe"
  },
  "message": "Registration successful"
}
```

**Validations:**
- Employee must exist in database
- Employee must not already have an account
- Email must be valid format
- Password minimum 6 characters (Supabase default)

---

#### 2. Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      ...
    }
  },
  "message": "Login successful"
}
```

---

#### 3. Forgot Password
```http
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Password reset email sent"
}
```

**Notes:**
- Email akan dikirim ke user dengan link reset password
- Link redirect ke `FRONTEND_URL/reset-password`

---

#### 4. Reset Password
```http
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "password": "newpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Password updated successfully"
}
```

**Notes:**
- Endpoint ini dipanggil setelah user klik link dari email
- Token reset password otomatis di-handle oleh Supabase

---

### Protected Routes

#### 5. Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Logout successful"
}
```

---

## Business Logic

### Registration Flow
1. Validate employee exists by `employee_id`
2. Check employee doesn't have `user_id` (not registered yet)
3. Create auth user via Supabase
4. Link `user_id` to employee record
5. Return user data + employee name

### Login Flow
1. Authenticate via Supabase
2. Return access token + user data
3. Token digunakan untuk protected endpoints

### Password Reset Flow
1. User request forgot password
2. Supabase send email with reset link
3. User click link → redirect to frontend
4. Frontend call reset-password endpoint
5. Password updated

---

## Logging

Module ini menggunakan Winston untuk logging:

### Info Logs
- User registered successfully
- User logged in
- User logged out

### Warning Logs
- Registration failed (employee not found)
- Registration failed (employee already has account)
- Login failed (invalid credentials)

### Error Logs
- Registration failed (auth error)

---

## Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Employee already has an account"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Employee not found"
}
```

---

## Dependencies

- **Supabase Auth**: User authentication
- **Supabase Database**: Employee data
- **Winston**: Logging
- **Auth Middleware**: Token verification (for protected routes)

---

## Environment Variables

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
FRONTEND_URL=http://localhost:5173
```

---

## Testing

### Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123","employee_id":"EMP001"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123"}'
```

### Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <token>"
```
