export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
} as const;

export const EMPLOYEE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  TERMINATED: 'terminated',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  EMPLOYEES: '/api/employees',
  BRANCHES: '/api/branches',
} as const;