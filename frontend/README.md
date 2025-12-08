# Suryamas Frontend

Frontend application untuk Suryamas Finance Management System.

## Tech Stack

- **React 18** - UI Library
- **TypeScript** - Type Safety
- **Vite** - Build Tool
- **TailwindCSS** - Styling
- **React Router** - Routing
- **Zustand** - State Management
- **Axios** - HTTP Client

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   └── Navbar.tsx
│   │   └── ui/
│   ├── lib/
│   │   └── axios.ts
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── employees/
│   │   │   ├── EmployeesPage.tsx
│   │   │   └── ProfilePage.tsx
│   │   └── HomePage.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── employeeStore.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env
├── package.json
└── README.md
```

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://localhost:3000/api
```

## Features

### Auth Module
- ✅ Login
- ✅ Register
- ✅ Logout
- ✅ Protected Routes
- ✅ Token Management

### Employees Module
- ✅ View Profile
- ✅ Edit Profile
- ✅ Search Employees
- ✅ Delete Employee

## Pages

### Public Pages
- `/` - Home page
- `/login` - Login page
- `/register` - Register page

### Protected Pages
- `/profile` - User profile
- `/employees` - Employee management

## State Management

### Auth Store
```typescript
{
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email, password) => Promise<void>
  register: (email, password, employee_id) => Promise<void>
  logout: () => Promise<void>
}
```

### Employee Store
```typescript
{
  employees: Employee[]
  profile: Employee | null
  isLoading: boolean
  fetchProfile: () => Promise<void>
  updateProfile: (data) => Promise<void>
  searchEmployees: (query) => Promise<void>
  deleteEmployee: (id) => Promise<void>
}
```

## API Integration

All API calls go through `src/lib/axios.ts` with:
- Automatic token injection
- 401 redirect to login
- Error handling

## Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Build Output
```bash
npm run build
# Output: dist/
```

## Development

```bash
# Start dev server
npm run dev

# Access at http://localhost:5173
```

## Production

```bash
# Build
npm run build

# Preview
npm run preview
```
