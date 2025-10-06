export type AuthRole = 'super_admin' | 'master_admin' | 'child_user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  password: string;
  parentId?: string;
}

export type SessionUser = Omit<AuthUser, 'password'>;

export interface LoginCredentials {
  email: string;
  password: string;
}
