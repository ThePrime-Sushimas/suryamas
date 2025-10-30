export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  branch_id?: string;
  branch_name?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  loading: boolean;
}