import React, { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { Button } from '../components/UI';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UserRoleRecord } from '../types';

type RoleType = 'admin' | 'gestor' | 'usuario';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRoleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleType>('usuario');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await dataService.getUserRoles();
      setUsers(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar lista de usuários: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSaveRole = async (emailToSave: string, userRole: RoleType) => {
    setLoading(true);
    try {
      await dataService.setUserRole(emailToSave, userRole);
      toast.success(`Permissão de ${emailToSave} atualizada para ${userRole}.`);
      await loadUsers();
    } catch (error: any) {
      toast.error('Erro ao atualizar papel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return toast.error('Informe o e-mail do usuário.');
    if (!normalizedEmail.includes('@')) return toast.error('Informe um e-mail válido.');

    setLoading(true);
    try {
      await dataService.setUserRole(normalizedEmail, role);
      toast.success(`Usuário ${normalizedEmail} cadastrado como ${role}.`);
      setEmail('');
      setRole('usuario');
      await loadUsers();
    } catch (error: any) {
      toast.error('Erro ao cadastrar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-slate-500 font-semibold">Gestão de Acesso</p>
            <h1 className="text-3xl font-bold text-slate-900">Controle de papéis de usuário</h1>
            <p className="max-w-2xl text-slate-600 mt-2">
              Defina se cada usuário é administrador, gestor ou usuário comum. Administradores têm acesso geral; gestores acessam dashboard, manuais, diagnóstico, checklist e histórico; usuários acessam apenas manuais, diagnóstico, checklist e histórico.
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="space-y-4 bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900">Cadastrar ou atualizar papel</h2>
            <form onSubmit={handleAddUser} className="grid gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">E-mail do usuário</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@empresa.com"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Papel</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleType)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="usuario">Usuário</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl">
                {loading ? 'Salvando...' : 'Salvar papel'}
              </Button>
            </form>
          </section>

          <section className="bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Usuários cadastrados</h2>
            <div className="space-y-3">
              {loading ? (
                <p className="text-slate-500">Carregando usuários...</p>
              ) : users.length === 0 ? (
                <p className="text-slate-500">Nenhum usuário encontrado. Cadastre um e-mail para iniciar.</p>
              ) : (
                users.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-200 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.email}</p>
                      <p className="text-sm text-slate-500">Registrado em {new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <select
                        value={item.role}
                        onChange={(e) => handleSaveRole(item.email, e.target.value as RoleType)}
                        className="rounded-2xl border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="usuario">Usuário</option>
                        <option value="gestor">Gestor</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Papel atual</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
