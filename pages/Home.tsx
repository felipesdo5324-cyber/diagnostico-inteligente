
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, History, ChevronRight, Zap, ClipboardCheck, LayoutDashboard, LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Button } from '../components/UI';
import { User } from '@supabase/supabase-js';

const NavCard: React.FC<{
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: 'green' | 'orange' | 'blue';
}> = ({ to, title, description, icon, color }) => {
  const colorMap = {
    green: 'from-green-400 to-green-600 group-hover:shadow-green-500/20 border-green-400/50 text-green-400',
    orange: 'from-orange-400 to-orange-600 group-hover:shadow-orange-500/20 border-orange-400/50 text-orange-400',
    blue: 'from-blue-400 to-blue-600 group-hover:shadow-blue-500/20 border-blue-400/50 text-blue-400',
  };

  const gradientMap = {
    green: 'from-green-500/10',
    orange: 'from-orange-500/10',
    blue: 'from-blue-500/10',
  };

  return (
    <Link to={to} className="group">
      <div className={`relative bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 hover:border-opacity-100 transition-all duration-300 overflow-hidden hover:shadow-2xl hover:-translate-y-2 h-full ${colorMap[color].split(' ')[2]}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientMap[color]} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
        <div className="relative p-8 flex flex-col h-full">
          <div className={`w-16 h-16 bg-gradient-to-br ${colorMap[color].split(' ')[0]} ${colorMap[color].split(' ')[1]} rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
          <p className="text-slate-200 mb-6 leading-relaxed flex-grow">
            {description}
          </p>
          <div className={`flex items-center font-medium group-hover:gap-3 gap-2 transition-all mt-auto ${colorMap[color].split(' ')[3]}`}>
            <span>Acessar</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const ADMIN_EMAIL = 'felipe.sdo17@gmail.com';

  useEffect(() => {
    dataService.getCurrentUser().then(setUser);
  }, []);

  const handleLogout = () => {
    if (confirm("Deseja realmente sair do sistema?")) {
      dataService.signOut();
    }
  };

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <div className="min-h-screen relative overflow-hidden font-sans" style={{
      background: 'linear-gradient(135deg, #0d2818 0%, #1a4d2e 50%, #0d2818 100%)'
    }}>
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 4px),
                          repeating-linear-gradient(90deg, transparent, transparent 2px, #fff 2px, #fff 4px)`
      }}></div>
      
      {/* User Bar */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <div className="flex flex-col items-end mr-2">
           <span className="text-white font-bold text-sm leading-none">{user?.email?.split('@')[0]}</span>
           <div className="flex items-center gap-1.5 mt-1">
             {isAdmin && (
               <span className="flex items-center gap-1 bg-indigo-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">
                 <ShieldCheck className="w-2.5 h-2.5" /> Administrador
               </span>
             )}
             <span className="text-green-400 text-[10px] uppercase font-black tracking-widest">Conectado</span>
           </div>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border text-white ${isAdmin ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/30' : 'bg-white/10 border-white/20'}`}>
           <UserIcon className="w-5 h-5" />
        </div>
        <button 
          onClick={handleLogout}
          className="p-3 bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md rounded-full border border-red-500/30 text-red-200 transition-all shadow-xl"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <div className="inline-block bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20 shadow-2xl">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695d0a9200ced41a30cb2042/2614e7d21_image.png" 
              alt="Tecnoloc"
              className="h-24 object-contain"
            />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Diagnóstico Técnico Inteligente
          </h1>
          <p className="text-xl text-green-100 max-w-2xl mx-auto">
            Análise especializada baseada em manuais técnicos e experiência acumulada.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="flex items-center gap-2 bg-orange-500/20 backdrop-blur-sm px-4 py-2 rounded-full border border-orange-400/30">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-100 font-medium">IA Integrada</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <NavCard to="/diagnostico" title="Novo Diagnóstico" description="Inicie uma análise completa de defeitos com apoio da inteligência artificial e visão computacional." icon={<Search className="w-8 h-8 text-white" />} color="green" />
          <NavCard to="/dashboard" title="Dashboard" description="Visualize o status da frota, manutenções pendentes e indicadores de performance em tempo real." icon={<LayoutDashboard className="w-8 h-8 text-white" />} color="blue" />
          <NavCard to="/manuais" title="Manuais Técnicos" description="Biblioteca digital completa com documentação técnica de todos os modelos de frota." icon={<FileText className="w-8 h-8 text-white" />} color="orange" />
          <NavCard to="/checklist" title="Checklist" description="Inspeção rigorosa de entrada e saída para garantir a qualidade dos equipamentos alugados." icon={<ClipboardCheck className="w-8 h-8 text-white" />} color="orange" />
          <NavCard to="/historico" title="Histórico" description="Acesse o registro completo de diagnósticos anteriores e soluções aplicadas pelos técnicos." icon={<History className="w-8 h-8 text-white" />} color="green" />
        </div>
      </div>
    </div>
  );
}
