# Suryamas - Finance Management System

Backend AUTH with Express.js + Supabase

## Backend Setup

```bash
cd backend
npm install
npm run dev
```

## Endpoints

- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update profile

## Environment Variables

Create `backend/.env`:
```
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```