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

## Features

### Auth Module
- ✅ Register
- ✅ Login
- ✅ Logout
- ✅ Forgot Password
- ✅ Reset Password

### Employees Module
- ✅ View Profile
- ✅ Edit Profile
- ✅ Search Employees
- ✅ Create Employee
- ✅ Delete Employee
- ✅ Autocomplete

## API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

### Employees
```
GET    /api/employees/search?q=<query>
GET    /api/employees/autocomplete?q=<query>
POST   /api/employees
DELETE /api/employees/:id
GET    /api/employees/profile
PUT    /api/employees/profile
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
