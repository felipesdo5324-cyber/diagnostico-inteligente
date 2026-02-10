// components/MainLayout.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, Outlet } from 'react-router-dom';
import { LayoutDashboard, FileText, LogOut, Search, History, ShieldCheck, Wrench } from "lucide-react";
import { dataService } from '../services/dataService';
import { User } from '@supabase/supabase-js';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const ADMIN_EMAIL = 'felipe.sdo17@gmail.com';

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await dataService.getCurrentUser();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <div className="app-layout"> {/* Classe que criamos no index.css */}
      {/* Sidebar - Fixa para todo o sistema */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded flex items-center justify-center font-bold ${isAdmin ? 'bg-indigo-600' : 'bg-green-500'}`}>T</div>
            <div>
              <h2 className="text-lg font-bold leading-none">Tecnoloc</h2>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Gestão de Frotas</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link to="/dashboard" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <LayoutDashboard className="mr-3 h-5 w-5" /> Visão Geral
          </Link>
          <Link to="/diagnostico" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <Search className="mr-3 h-5 w-5" /> Diagnóstico IA
          </Link>
          <Link to="/historico" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <History className="mr-3 h-5 w-5" /> Histórico
          </Link>
          <Link to="/manuais" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <FileText className="mr-3 h-5 w-5" /> Manuais
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => navigate('/login')} className="w-full flex items-center justify-center px-4 py-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo da Página */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-2xl font-bold text-slate-800">Portal Técnico</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{user?.email?.split('@')[0]}</p>
              <div className="flex items-center justify-end gap-1">
                {isAdmin && <ShieldCheck className="w-3 h-3 text-indigo-600" />}
                <p className="text-xs text-slate-500">{isAdmin ? 'Administrador' : 'Técnico Sênior'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* O Outlet é onde as páginas (Dashboard, History, etc) serão renderizadas */}
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet /> 
        </div>
      </main>
    </div>
  );
};