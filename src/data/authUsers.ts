import { AuthUser } from '../types/auth';

export const mockAuthUsers: AuthUser[] = [
  {
    id: 'user-1',
    name: 'Ana Souza',
    email: 'ana.souza@linka.com',
    role: 'super_admin',
    password: 'admin123',
  },
  {
    id: 'user-2',
    name: 'Bruno Lima',
    email: 'bruno.lima@empresa.com',
    role: 'master_admin',
    password: 'master123',
    parentId: 'user-1',
  },
  {
    id: 'user-3',
    name: 'Carla Ribeiro',
    email: 'carla.ribeiro@empresa.com',
    role: 'child_user',
    password: 'user123',
    parentId: 'user-2',
  },
];
