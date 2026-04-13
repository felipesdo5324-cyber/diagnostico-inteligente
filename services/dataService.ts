import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { MaintenanceLog, Manual } from '../types';

declare global {
  interface ImportMeta {
    env: any;
  }
}

const getCredential = (key: string): string | undefined => {
  const viteKey = `VITE_${key}`;
  return import.meta.env[viteKey] || import.meta.env[key];
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
    console.error('Erro ao inicializar Supabase:', error);
    return null;
  }
};

export const dataService = {
  isConfigured: () => !!getSupabase(),

  signIn: async (email: string, pass: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    return data;
  },

  signUp: async (email: string, pass: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) throw error;
    return data;
  },

  updatePassword: async (newPassword: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
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
    const { data, error } = await sb
      .from('maintenance_logs')
      .select('*')
      .order('date', { ascending: false });
    return error ? [] : (data || []);
  },

  saveLog: async (log: Omit<MaintenanceLog, 'id' | 'date'>): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const { error } = await sb
      .from('maintenance_logs')
      .insert([{ ...log, date: new Date().toISOString() }]);
    if (error) throw error;
  },

  getManuals: async (): Promise<Manual[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from('manuals')
      .select('*')
      .order('created_at', { ascending: false });
    return error ? [] : (data || []);
  },

  saveManual: async (manual: Omit<Manual, 'id'>): Promise<Manual> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const { data, error } = await sb.from('manuals').insert([manual]).select().single();
    if (error) throw error;
    return data;
  },

  deleteManual: async (id: string): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const { error } = await sb.from('manuals').delete().eq('id', id);
    if (error) throw error;
  },

  findManualByModel: async (modelName: string): Promise<Manual | undefined> => {
    const sb = getSupabase();
    if (!sb || !modelName) return undefined;
    const { data, error } = await sb
      .from('manuals')
      .select('*')
      .ilike('model', `%${modelName}%`)
      .limit(1);
    return error ? undefined : data?.[0];
  },

  findManualByName: async (
    equipmentName: string,
    model?: string
  ): Promise<Manual | undefined> => {
    const sb = getSupabase();
    if (!sb) return undefined;
    if (model?.trim()) {
      const { data: byModel } = await sb
        .from('manuals')
        .select('*')
        .ilike('model', `%${model.trim()}%`)
        .limit(1);
      if (byModel?.[0]) return byModel[0];
    }
    if (equipmentName?.trim()) {
      const { data: byName } = await sb
        .from('manuals')
        .select('*')
        .ilike('equipment_name', `%${equipmentName.trim()}%`)
        .limit(1);
      if (byName?.[0]) return byName[0];
    }
    return undefined;
  },

  getUserRoleByEmail: async (
    email: string
  ): Promise<'admin' | 'gestor' | 'usuario' | null> => {
    const sb = getSupabase();
    if (!sb || !email) return null;
    const normalizedEmail = email.trim().toLowerCase();
    console.log('Buscando role para email:', normalizedEmail);

    const { data: allRoles, error: allError } = await sb
      .from('user_roles')
      .select('email, role');
    console.log('Todos os roles na tabela:', allRoles);
    if (allError) console.warn('Erro ao listar todos:', allError.message);

    const { data, error } = await sb
      .from('user_roles')
      .select('role')
      .eq('email', normalizedEmail)
      .maybeSingle();
    console.log('Resultado da query para', normalizedEmail, ':', { data, error });

    if (error) {
      console.warn('Erro ao buscar role:', error.message);
      return null;
    }
    return data?.role ?? null;
  },

  getCurrentUserRole: async (): Promise<'admin' | 'gestor' | 'usuario' | null> => {
    const user = await dataService.getCurrentUser();
    if (!user?.email) return null;
    const role = await dataService.getUserRoleByEmail(user.email);
    return role ?? 'usuario';
  },

  getUserRoles: async (): Promise<
    Array<{
      id: string;
      email: string;
      role: 'admin' | 'gestor' | 'usuario';
      created_at?: string;
    }>
  > => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from('user_roles')
      .select('*')
      .order('email', { ascending: true });
    return error ? [] : (data || []);
  },

  setUserRole: async (
    email: string,
    role: 'admin' | 'gestor' | 'usuario'
  ): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await sb
      .from('user_roles')
      .upsert({ email: normalizedEmail, role }, { onConflict: 'email' });
    if (error) throw error;
  },

  getManualSections: async (manualId: string): Promise<string> => {
    const sb = getSupabase();
    if (!sb || !manualId) return '';
    const { data, error } = await sb
      .from('manual_sections')
      .select('content')
      .eq('manual_id', manualId)
      .order('id', { ascending: true });
    if (error || !data?.length) return '';
    return data.map((r: any) => r.content).join('\n\n');
  },

  semanticSearchManual: async (
    query: string,
    manualId: string,
    topK = 10
  ): Promise<string> => {
    try {
      const response = await fetch('/api/search-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, manualId, topK }),
      });
      if (!response.ok) return '';
      const data = await response.json();
      return Array.isArray(data.chunks) ? data.chunks.join('\n\n') : '';
    } catch {
      return '';
    }
  },

  uploadFile: async (
    file: File
  ): Promise<{ file_url: string; file_name: string; file_path: string }> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `manuals/${fileName}`;
    const { error: uploadError } = await sb.storage
      .from('tecnoloc_assets')
      .upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data } = sb.storage.from('tecnoloc_assets').getPublicUrl(filePath);
    return { file_url: data.publicUrl, file_name: file.name, file_path: filePath };
  },

  saveFailureManual: async (data: {
    titulo?: string;
    categoria: 'eletrica' | 'mecanica';
    equipamento: string;
    marca: string;
    modelo: string;
    codigo?: string | null;
    descricao: string;
    causa_provavel: string;
    acao_tecnica: string;
    attachment_url?: string | null;
    fileUrl?: string | null;
  }): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const insertRow = {
      titulo: data.titulo || `${data.equipamento} - ${data.descricao}`,
      categoria: data.categoria,
      equipamento: data.equipamento,
      marca: data.marca,
      modelo: data.modelo,
      codigo: data.codigo ?? null,
      descricao: data.descricao,
      causa_provavel: data.causa_provavel,
      acao_tecnica: data.acao_tecnica,
      attachment_url: data.attachment_url ?? null,
      file_url: data.fileUrl ?? null,
    };
    const { error } = await sb.from('failure_manuals').insert([insertRow]);
    if (error) throw error;
  },

  getFailureManuals: async (): Promise<any[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from('failure_manuals')
      .select('*')
      .order('created_at', { ascending: false });
    return error ? [] : (data || []);
  },

  deleteFailureManual: async (id: string): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const { error } = await sb.from('failure_manuals').delete().eq('id', id);
    if (error) throw error;
  },

  // ── NOVAS FUNÇÕES: busca no failure_manuals para o diagnóstico ──────────────

  /**
   * Extrai códigos de falha do texto digitado pelo técnico.
   * Ex: "falha 1434" → ["1434"]
   * Ex: "código P0123 ativado" → ["P0123"]
   */
  extractCodesFromText: (text: string): string[] => {
    if (!text) return [];
    const patterns = [
      /\b([A-Z]{1,3}\d{3,6})\b/g,       // Alfanumérico: P0123, E001
      /\bfalha[:\s#]+(\d{2,6})\b/gi,     // "falha 1434"
      /\bcódigo[:\s#]+(\d{2,6})\b/gi,    // "código 234"
      /\bcod[:\s#]+(\d{2,6})\b/gi,       // "cod 234"
      /\berro[:\s#]+(\d{2,6})\b/gi,      // "erro 121"
      /\balarme[:\s#]+(\d{2,6})\b/gi,    // "alarme 151"
      /\b(\d{3,4})\b/g,                  // Número isolado 3-4 dígitos
    ];

    const found = new Set<string>();
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        found.add(match[1].toUpperCase());
      }
    }
    return Array.from(found);
  },

  /**
   * Busca falhas na failure_manuals por código exato.
   * Ex: codigo = "1434" → retorna "Parada de Emergência Remota"
   */
  findFailureByCode: async (codigo: string): Promise<any[]> => {
    const sb = getSupabase();
    if (!sb || !codigo) return [];
    const { data, error } = await sb
      .from('failure_manuals')
      .select('codigo, descricao, causa_provavel, acao_tecnica, equipamento, marca, modelo')
      .eq('codigo', codigo.trim())
      .limit(5);
    if (error) {
      console.warn('[findFailureByCode] Erro:', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Busca falhas na failure_manuals por equipamento/marca/modelo.
   * Usado quando não há código específico no relato do técnico.
   */
  findFailuresByEquipment: async (
    equipamento: string,
    marca?: string,
    modelo?: string
  ): Promise<any[]> => {
    const sb = getSupabase();
    if (!sb) return [];

    let query = sb
      .from('failure_manuals')
      .select('codigo, descricao, causa_provavel, acao_tecnica, equipamento, marca, modelo')
      .order('created_at', { ascending: false })
      .limit(20);

    if (modelo?.trim()) {
      query = query.ilike('modelo', `%${modelo.trim()}%`);
    } else if (marca?.trim()) {
      query = query.ilike('marca', `%${marca.trim()}%`);
    } else if (equipamento?.trim()) {
      query = query.ilike('equipamento', `%${equipamento.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[findFailuresByEquipment] Erro:', error.message);
      return [];
    }
    return data || [];
  },
};