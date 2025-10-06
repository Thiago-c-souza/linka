import React, { useEffect, useMemo, useState } from 'react';
import { AuthRole, AuthUser, SessionUser } from '../../types/auth';
import { KeyRound, Shield, UserPlus, Users } from 'lucide-react';

interface UserHierarchyManagerProps {
  currentUser: SessionUser;
  users: AuthUser[];
  onUsersChange: (nextUsers: AuthUser[]) => void;
}

const roleLabels: Record<AuthRole, string> = {
  super_admin: 'Admin geral',
  master_admin: 'Usuário mestre',
  child_user: 'Usuário filho',
};

const creationRules: Record<AuthRole, AuthRole[]> = {
  super_admin: ['master_admin', 'child_user'],
  master_admin: ['child_user'],
  child_user: [],
};

interface FormState {
  name: string;
  email: string;
  password: string;
  role: AuthRole;
  parentId?: string;
}

export const UserHierarchyManager: React.FC<UserHierarchyManagerProps> = ({
  currentUser,
  users,
  onUsersChange,
}) => {
  const availableRoles = creationRules[currentUser.role];
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const masters = useMemo(() => users.filter(user => user.role === 'master_admin'), [users]);
  const superAdmins = useMemo(() => users.filter(user => user.role === 'super_admin'), [users]);
  const childrenByParent = useMemo(() => {
    return users
      .filter(user => user.role === 'child_user')
      .reduce<Record<string, AuthUser[]>>((accumulator, user) => {
        if (!user.parentId) {
          return accumulator;
        }
        if (!accumulator[user.parentId]) {
          accumulator[user.parentId] = [];
        }
        accumulator[user.parentId].push(user);
        return accumulator;
      }, {});
  }, [users]);

  const defaultRole = availableRoles[0] ?? 'child_user';
  const defaultParentId =
    currentUser.role === 'master_admin'
      ? currentUser.id
      : currentUser.role === 'super_admin' && masters.length > 0
        ? masters[0].id
        : undefined;

  const [formState, setFormState] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    role: defaultRole,
    parentId: defaultParentId,
  });

  useEffect(() => {
    setFormState({
      name: '',
      email: '',
      password: '',
      role: defaultRole,
      parentId: defaultParentId,
    });
    setFeedback(null);
  }, [defaultRole, defaultParentId, currentUser.id]);

  const resetForm = (nextRole?: AuthRole) => {
    const derivedRole = nextRole ?? availableRoles[0] ?? 'child_user';
    setFormState({
      name: '',
      email: '',
      password: '',
      role: derivedRole,
      parentId:
        currentUser.role === 'master_admin'
          ? currentUser.id
          : currentUser.role === 'super_admin' && masters.length > 0
            ? masters[0].id
            : undefined,
    });
  };

  const handleInputChange = (field: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleRoleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as AuthRole;
    setFormState(prev => ({
      ...prev,
      role: value,
      parentId: value === 'child_user'
        ? currentUser.role === 'master_admin'
          ? currentUser.id
          : masters[0]?.id ?? prev.parentId ?? ''
        : currentUser.id,
    }));
  };

  const emailExists = (email: string) =>
    users.some(user => user.email.toLowerCase() === email.toLowerCase());

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (availableRoles.length === 0) {
      setFeedback({ type: 'error', message: 'Você não possui permissão para criar novos usuários.' });
      return;
    }

    const { name, email, password, role } = formState;
    if (!name || !email || !password) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos para criar o usuário.' });
      return;
    }

    if (emailExists(email)) {
      setFeedback({ type: 'error', message: 'Já existe um usuário com este e-mail cadastrado.' });
      return;
    }

    let parentId = formState.parentId;

    if (role === 'master_admin') {
      parentId = currentUser.id;
    }

    if (role === 'child_user') {
      if (currentUser.role === 'master_admin') {
        parentId = currentUser.id;
      }

      if (!parentId) {
        setFeedback({ type: 'error', message: 'Selecione o usuário mestre responsável por este usuário filho.' });
        return;
      }
    }

    const newUser: AuthUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      password,
      role,
      parentId,
    };

    onUsersChange([...users, newUser]);
    setFeedback({ type: 'success', message: `${roleLabels[role]} criado com sucesso.` });
    resetForm(role);
  };

  const renderChildren = (parentId: string) => {
    const children = childrenByParent[parentId] ?? [];
    if (children.length === 0) {
      return (
        <p className="text-sm text-gray-400">Nenhum usuário filho vinculado.</p>
      );
    }

    return (
      <ul className="space-y-2">
        {children.map(child => (
          <li
            key={child.id}
            className="flex items-center justify-between bg-slate-800/40 border border-slate-700 rounded-xl px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-white">{child.name}</p>
              <p className="text-xs text-slate-300">{child.email}</p>
            </div>
            <span className="text-xs text-blue-300 capitalize">{roleLabels[child.role]}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Hierarquia de usuários</h2>
            <p className="text-sm text-gray-600">
              Controle quem pode criar novos acessos de acordo com o nível atual do usuário logado.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm">
            <Shield size={18} />
            <span>
              Você está logado como <strong>{roleLabels[currentUser.role]}</strong>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">Admin geral</h3>
            <p className="text-gray-600">Pode criar usuários mestres e filhos para qualquer operação.</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">Usuário mestre</h3>
            <p className="text-gray-600">Pode criar e gerenciar apenas usuários filhos da sua operação.</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">Usuário filho</h3>
            <p className="text-gray-600">Não possui permissão para criar novos acessos.</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Criar novo usuário</h3>
              <p className="text-sm text-gray-600">Disponível conforme o nível de permissão atual.</p>
            </div>
          </div>

          {availableRoles.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-xl px-4 py-3">
              Usuários filhos não podem criar novos acessos. Entre como usuário mestre ou admin geral para cadastrar mais contas.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Nome completo</label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={handleInputChange('name')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nome do usuário"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">E-mail corporativo</label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={handleInputChange('email')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="usuario@empresa.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Senha temporária</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={formState.password}
                      onChange={handleInputChange('password')}
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Defina uma senha inicial"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Nível de acesso</label>
                  <select
                    value={formState.role}
                    onChange={handleRoleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {availableRoles.map(role => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formState.role === 'child_user' && currentUser.role === 'super_admin' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Usuário mestre responsável</label>
                  <select
                    value={formState.parentId ?? ''}
                    onChange={handleInputChange('parentId')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione um usuário mestre</option>
                    {masters.map(master => (
                      <option key={master.id} value={master.id}>
                        {master.name} ({master.email})
                      </option>
                    ))}
                  </select>
                  {masters.length === 0 && (
                    <p className="text-xs text-red-500">Cadastre um usuário mestre antes de criar usuários filhos.</p>
                  )}
                </div>
              )}

              {feedback && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm border ${
                    feedback.type === 'success'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold hover:bg-blue-700 transition-colors"
              >
                Criar usuário
              </button>
            </form>
          )}
        </div>

        <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Usuários cadastrados</h3>
              <p className="text-sm text-slate-300">Visualize a hierarquia atual de admins, mestres e filhos.</p>
            </div>
          </div>

          <div className="space-y-4">
            {superAdmins.map(admin => (
              <div key={admin.id} className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{admin.name}</p>
                    <p className="text-xs text-slate-300">{admin.email}</p>
                  </div>
                  <span className="text-xs bg-blue-500/20 border border-blue-400/30 px-2 py-1 rounded-full">
                    {roleLabels[admin.role]}
                  </span>
                </div>

                {masters
                  .filter(master => master.parentId === admin.id)
                  .map(master => (
                    <div key={master.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{master.name}</p>
                          <p className="text-xs text-slate-300">{master.email}</p>
                        </div>
                        <span className="text-xs bg-purple-500/20 border border-purple-400/30 px-2 py-1 rounded-full">
                          {roleLabels[master.role]}
                        </span>
                      </div>

                      <div className="pl-3 border-l border-slate-700 space-y-2">
                        {renderChildren(master.id)}
                      </div>
                    </div>
                  ))}
              </div>
            ))}

            {masters.filter(master => !master.parentId).length > 0 && (
              <div className="bg-white/5 rounded-xl border border-amber-400/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-200">
                  Usuários mestres sem vínculo com um admin geral
                </p>
                <ul className="space-y-2 text-sm text-slate-200">
                  {masters
                    .filter(master => !master.parentId)
                    .map(master => (
                      <li key={master.id} className="flex items-center justify-between">
                        <span>{master.name}</span>
                        <span className="text-xs text-slate-400">{master.email}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
