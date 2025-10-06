import React, { useState } from 'react';
import { Lock, Mail, LogIn, Shield, Users } from 'lucide-react';
import { AuthUser, LoginCredentials } from '../../types/auth';

interface LoginViewProps {
  onLogin: (credentials: LoginCredentials) => void;
  error?: string | null;
  users?: AuthUser[];
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, error, users }) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onLogin(credentials);
  };

  const handleChange = (field: keyof LoginCredentials) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCredentials(prev => ({ ...prev, [field]: event.target.value }));
  };

  const demoAccounts = users ?? [];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8">
        <div className="bg-white/10 backdrop-blur rounded-3xl p-6 sm:p-10 text-white border border-white/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/40">
              <Shield className="text-blue-300" size={28} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Linka Fleet</h1>
              <p className="text-sm text-white/70">Console seguro para gestão de frotas</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">Hierarquia de acesso</h2>
              <p className="text-sm text-white/70">
                Admin geral controla usuários mestres, que por sua vez criam e gerem usuários filhos restritos. Utilize o login
                adequado para testar os diferentes níveis de permissão.
              </p>
            </div>

            {demoAccounts.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Users size={16} />
                  Contas de demonstração
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-white/70">
                  {demoAccounts.map(account => (
                    <li
                      key={account.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4"
                    >
                      <span className="font-medium text-white">{account.email}</span>
                      <span className="capitalize text-blue-200">
                        {account.role.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-white/60">Senha: {account.password}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10">
          <div className="space-y-2 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Acesse sua conta</h2>
            <p className="text-gray-500">Entre com seu e-mail corporativo para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="email"
                  type="email"
                  value={credentials.email}
                  onChange={handleChange('email')}
                  placeholder="seu.email@empresa.com"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={handleChange('password')}
                  placeholder="********"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-2xl font-semibold hover:bg-blue-700 transition-colors"
            >
              <LogIn size={18} />
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
