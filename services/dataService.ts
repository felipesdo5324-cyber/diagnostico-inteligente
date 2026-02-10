
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { MaintenanceLog, Manual } from '../types';

// Função para buscar credenciais priorizando process.env para compatibilidade total
const getCredential = (key: string): string | undefined => {
  const viteKey = `VITE_${key}`;
  return (process.env as any)[key] || 
         (process.env as any)[viteKey] || 
         (import.meta as any).env?.[viteKey] || 
         (import.meta as any).env?.[key];
};

let supabaseInstance: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;
  
  const url = getCredential('SUPABASE_URL');
  const key = getCredential('SUPABASE_ANON_KEY');
  
  if (!url || !key) return null;

  try {
    supabaseInstance = createClient(url, key);
    return supabaseInstance;
  } catch (error) {
    console.error("Erro ao inicializar Supabase:", error);
    return null;
  }
};

export const dataService = {
  isConfigured: () => !!getSupabase(),

  signIn: async (email: string, pass: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Configuração do Supabase ausente.");
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    return data;
  },

  signUp: async (email: string, pass: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Configuração do Supabase ausente.");
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) throw error;
    return data;
  },

  updatePassword: async (newPassword: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Configuração do Supabase ausente.");
    const { data, error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    window.location.href = '#/login';
  },

  getCurrentUser: async (): Promise<User | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data: { user } } = await sb.auth.getUser();
      return user;
    } catch {
      return null;
    }
  },

  getLogs: async (): Promise<MaintenanceLog[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('maintenance_logs').select('*').order('date', { ascending: false });
    return error ? [] : (data || []);
  },

  saveLog: async (log: Omit<MaintenanceLog, 'id' | 'date'>): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error("Configuração do Supabase ausente.");
    const { error } = await sb.from('maintenance_logs').insert([{ ...log, date: new Date().toISOString() }]);
    if (error) throw error;
  },

  getManuals: async (): Promise<Manual[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('manuals').select('*').order('created_at', { ascending: false });
    return error ? [] : (data || []);
  },

  saveManual: async (manual: Omit<Manual, 'id'>): Promise<Manual> => {
    const sb = getSupabase();
    if (!sb) throw new Error("Configuração do Supabase ausente.");
    const { data, error } = await sb.from('manuals').insert([manual]).select().single();
    if (error) throw error;
    return data;
  },

  deleteManual: async (id: string): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error("Configuração do Supabase ausente.");
    const { error } = await sb.from('manuals').delete().eq('id', id);
    if (error) throw error;
  },

  findManualByModel: async (modelName: string): Promise<Manual | undefined> => {
    const sb = getSupabase();
    if (!sb || !modelName) return undefined;
    const { data, error } = await sb.from('manuals').select('*').ilike('model', `%${modelName}%`).limit(1);
    return error ? undefined : data?.[0];
  },

  uploadFile: async (file: File): Promise<{ file_url: string; file_name: string }> => {
    const sb = getSupabase();
    if (!sb) throw new Error("Configuração do Supabase ausente.");
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `manuals/${fileName}`;
    const { error: uploadError } = await sb.storage.from('tecnoloc_assets').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data } = sb.storage.from('tecnoloc_assets').getPublicUrl(filePath);
    return { file_url: data.publicUrl, file_name: file.name };
  }
};
