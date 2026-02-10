
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wrench, 
  FileText, 
  LogOut, 
  Search,
  ChevronRight,
  History,
  Zap,
  ShieldCheck
} from "lucide-react";
import { dataService } from '../services/dataService';
import { User } from '@supabase/supabase-js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [logsCount, setLogsCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const ADMIN_EMAIL = 'felipe.sdo17@gmail.com';

  useEffect(() => {
    const fetchData = async () => {
      const logs = await dataService.getLogs();
      setLogsCount(logs.length);
      const currentUser = await dataService.getCurrentUser();
      setUser(currentUser);
    };
    fetchData();
  }, []);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
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
          <Link to="/dashboard" className="flex items-center px-4 py-3 text-blue-400 bg-slate-800 rounded-lg">
            <LayoutDashboard className="mr-3 h-5 w-5" />
            Visão Geral
          </Link>
          <Link to="/diagnostico" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <Search className="mr-3 h-5 w-5" />
            Diagnóstico IA
          </Link>
          <Link to="/historico" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <History className="mr-3 h-5 w-5" />
            Histórico
          </Link>
          <Link to="/manuais" className="flex items-center px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <FileText className="mr-3 h-5 w-5" />
            Manuais
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => navigate('/')} 
            className="w-full flex items-center justify-center px-4 py-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-2xl font-bold text-slate-800">Visão Geral</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{user?.email?.split('@')[0]}</p>
              <div className="flex items-center justify-end gap-1">
                {isAdmin && <ShieldCheck className="w-3 h-3 text-indigo-600" />}
                <p className="text-xs text-slate-500">{isAdmin ? 'Administrador' : 'Técnico Sênior'}</p>
              </div>
            </div>
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold uppercase ${isAdmin ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-200 border-slate-300 text-slate-500'}`}>
              {user?.email?.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 text-sm font-medium">Equipamentos Ativos</h3>
                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Wrench className="w-4 h-4" /></span>
              </div>
              <p className="text-3xl font-bold text-slate-900">142</p>
              <p className="text-xs text-green-600 mt-2 font-medium">+3% vs mês anterior</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 text-sm font-medium">Diagnósticos IA</h3>
                <span className="p-2 bg-green-50 text-green-600 rounded-lg"><Search className="w-4 h-4" /></span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{logsCount}</p>
              <p className="text-xs text-slate-500 mt-2">Total realizado</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 text-sm font-medium">Eficiência da IA</h3>
                <span className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Zap className="w-4 h-4" /></span>
              </div>
              <p className="text-3xl font-bold text-green-600">94%</p>
              <p className="text-xs text-slate-500 mt-2">Taxa de assertividade</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 text-sm font-medium">Manutenções Críticas</h3>
                <span className="p-2 bg-red-50 text-red-600 rounded-lg"><History className="w-4 h-4" /></span>
              </div>
              <p className="text-3xl font-bold text-red-600">8</p>
              <p className="text-xs text-red-500 mt-2 font-medium">Requer atenção imediata</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-xl border border-slate-200 min-h-[400px] flex flex-col items-center justify-center text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <LayoutDashboard className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Gráficos de Desempenho</h3>
              <p className="max-w-xs mx-auto">Visualize o tempo médio de reparo e disponibilidade da frota por categoria de equipamento.</p>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Ações Rápidas</h3>
              <div className="space-y-4">
                <button 
                  onClick={() => navigate('/diagnostico')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 group"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-500 text-white rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800">Novo Diagnóstico</p>
                      <p className="text-xs text-slate-500">Análise técnica com IA</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                <button 
                  onClick={() => navigate('/manuais')}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 group"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-orange-500 text-white rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800">Consultar Manuais</p>
                      <p className="text-xs text-slate-500">Documentação técnica</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}