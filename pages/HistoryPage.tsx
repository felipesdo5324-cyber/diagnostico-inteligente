
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { dataService } from '../services/dataService';

export default function HistoryPage() {
  const navigate = useNavigate();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['maintenance_logs'],
    queryFn: () => dataService.getLogs(),
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center text-slate-600 mb-8 font-medium">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </button>

        <h1 className="text-4xl font-black text-slate-900 mb-2">Histórico Global</h1>
        <p className="text-slate-500 mb-10">Memória técnica sincronizada via Supabase Cloud.</p>

        {isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-600" />
            <p className="text-slate-500 mt-4">Buscando histórico...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-slate-200 text-center">
            <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Nenhum registro encontrado na nuvem.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-200 transition-all shadow-sm">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${log.status === 'Resolvido' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                      {log.status === 'Resolvido' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{log.brand} {log.equipment_model}</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{new Date(log.date).toLocaleDateString('pt-BR')} às {new Date(log.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${log.status === 'Resolvido' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {log.status}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Relato Inicial</h4>
                    <p className="text-sm text-slate-700 italic">"{log.defect_description}"</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Solução Aplicada</h4>
                    <p className="text-sm text-slate-800 font-medium">{log.technician_notes || "Nenhuma nota adicional."}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
