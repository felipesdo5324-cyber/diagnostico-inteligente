import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { MaintenanceLog, Manual } from '../types';

declare global {
  interface ImportMeta { env: any; }
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
    } catch { return null; }
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

  /**
   * Busca histórico de resoluções ALTERNATIVAS (forma_diferente).
   * São os casos onde o técnico resolveu de forma diferente do que a IA sugeriu.
   * Essas experiências de campo valem mais do que o manual — são conhecimento real.
   *
   * @param modelo        Modelo do equipamento
   * @param categoria     Categoria da falha
   * @param descricaoFalha Descrição para filtrar por similaridade textual
   */
  getAlternativeResolutions: async (
    modelo?: string,
    categoria?: string,
    descricaoFalha?: string
  ): Promise<Array<{ descricao: string; solucao: string; equipamento: string; modelo: string }>> => {
    const sb = getSupabase();
    if (!sb) return [];

    let query = sb
      .from('maintenance_logs')
      .select('equipment_name, equipment_model, defect_description, technician_notes, defect_category')
      .eq('resolution_type', 'forma_diferente')   // ← apenas resoluções alternativas
      .not('technician_notes', 'is', null)
      .neq('technician_notes', '')
      .order('date', { ascending: false })
      .limit(10);

    if (modelo?.trim()) {
      query = query.ilike('equipment_model', `%${modelo.trim()}%`);
    } else if (categoria?.trim()) {
      query = query.eq('defect_category', categoria.trim());
    }

    const { data, error } = await query;
    if (error || !data?.length) return [];

    return data.map((log: any) => ({
      descricao:   log.defect_description || '',
      solucao:     log.technician_notes   || '',
      equipamento: log.equipment_name     || '',
      modelo:      log.equipment_model    || '',
    }));
  },

  getManuals: async (): Promise<Manual[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('manuals').select('*').order('created_at', { ascending: false });
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
    const { data, error } = await sb.from('manuals').select('*').ilike('model', `%${modelName}%`).limit(1);
    return error ? undefined : data?.[0];
  },

  findManualByName: async (equipmentName: string, model?: string): Promise<Manual | undefined> => {
    const sb = getSupabase();
    if (!sb) return undefined;
    if (model?.trim()) {
      const { data: byModel } = await sb.from('manuals').select('*').ilike('model', `%${model.trim()}%`).limit(1);
      if (byModel?.[0]) return byModel[0];
    }
    if (equipmentName?.trim()) {
      const { data: byName } = await sb.from('manuals').select('*').ilike('equipment_name', `%${equipmentName.trim()}%`).limit(1);
      if (byName?.[0]) return byName[0];
    }
    return undefined;
  },

  getUserRoleByEmail: async (email: string): Promise<'admin' | 'gestor' | 'usuario' | null> => {
    const sb = getSupabase();
    if (!sb || !email) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const { data: allRoles, error: allError } = await sb.from('user_roles').select('email, role');
    console.log('Todos os roles:', allRoles);
    if (allError) console.warn('Erro ao listar todos:', allError.message);
    const { data, error } = await sb.from('user_roles').select('role').eq('email', normalizedEmail).maybeSingle();
    if (error) { console.warn('Erro ao buscar role:', error.message); return null; }
    return data?.role ?? null;
  },

  getCurrentUserRole: async (): Promise<'admin' | 'gestor' | 'usuario' | null> => {
    const user = await dataService.getCurrentUser();
    if (!user?.email) return null;
    return (await dataService.getUserRoleByEmail(user.email)) ?? 'usuario';
  },

  getUserRoles: async (): Promise<Array<{ id: string; email: string; role: 'admin' | 'gestor' | 'usuario'; created_at?: string }>> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('user_roles').select('*').order('email', { ascending: true });
    return error ? [] : (data || []);
  },

  setUserRole: async (email: string, role: 'admin' | 'gestor' | 'usuario'): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const { error } = await sb.from('user_roles').upsert({ email: email.trim().toLowerCase(), role }, { onConflict: 'email' });
    if (error) throw error;
  },

  getManualSections: async (manualId: string): Promise<string> => {
    const sb = getSupabase();
    if (!sb || !manualId) return '';
    const { data, error } = await sb.from('manual_sections').select('content').eq('manual_id', manualId).order('id', { ascending: true });
    if (error || !data?.length) return '';
    return data.map((r: any) => r.content).join('\n\n');
  },

  semanticSearchManual: async (query: string, manualId: string, topK = 10): Promise<string> => {
    try {
      const response = await fetch('/api/search-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, manualId, topK }),
      });
      if (!response.ok) return '';
      const data = await response.json();
      return Array.isArray(data.chunks) ? data.chunks.join('\n\n') : '';
    } catch { return ''; }
  },

  uploadFile: async (file: File): Promise<{ file_url: string; file_name: string; file_path: string }> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `manuals/${fileName}`;
    const { error: uploadError } = await sb.storage.from('tecnoloc_assets').upload(filePath, file);
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
  }): Promise<string> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');

    const { data: inserted, error } = await sb
      .from('failure_manuals')
      .insert([{
        titulo:         data.titulo || `${data.equipamento} - ${data.descricao}`,
        categoria:      data.categoria,
        equipamento:    data.equipamento,
        marca:          data.marca,
        modelo:         data.modelo,
        codigo:         data.codigo         ?? null,
        descricao:      data.descricao,
        causa_provavel: data.causa_provavel,
        acao_tecnica:   data.acao_tecnica,
        attachment_url: data.attachment_url ?? null,
        file_url:       data.fileUrl        ?? null,
      }])
      .select('id')
      .single();

    if (error) throw error;

    // Gera embedding automaticamente em background (não bloqueia o save)
    fetch('/api/embed-failure-manuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inserted.id }),
    }).catch((err) => console.warn('[saveFailureManual] Embedding background falhou:', err));

    return inserted.id;
  },

  getFailureManuals: async (): Promise<any[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('failure_manuals').select('*').order('created_at', { ascending: false });
    return error ? [] : (data || []);
  },

  deleteFailureManual: async (id: string): Promise<void> => {
    const sb = getSupabase();
    if (!sb) throw new Error('Configuração do Supabase ausente.');
    const { error } = await sb.from('failure_manuals').delete().eq('id', id);
    if (error) throw error;
  },

  // ── BUSCA SEMÂNTICA (OPÇÃO B — PRINCIPAL DO HÍBRIDO) ───────────────────────
  /**
   * Busca falhas por similaridade semântica com o relato do técnico.
   * Threshold 0.55: reduz falsos negativos mantendo o fluxo híbrido atual.
   * "bba d'água vazando" → "Falha na Bomba de Transferência" (0.81) ✅
   */
  findFailuresBySimilarity: async (
    relato: string,
    threshold = 0.55,
    marca?: string,
    modelo?: string
  ): Promise<any[]> => {
    if (!relato.trim()) return [];
    try {
      const response = await fetch('/api/search-failure-manuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relato, threshold, marca, modelo, limit: 5 }),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.results) ? data.results : [];
    } catch (err) {
      console.warn('[findFailuresBySimilarity]', err);
      return [];
    }
  },

  // ── BUSCA EXATA POR CÓDIGO ─────────────────────────────────────────────────
  extractCodesFromText: (text: string): string[] => {
    if (!text) return [];
    const patterns = [
      /\b([A-Z]{1,3}\d{3,6})\b/g,
      /\bfalha[:\s#]+(\d{2,6})\b/gi,
      /\bcódigo[:\s#]+(\d{2,6})\b/gi,
      /\bcod[:\s#]+(\d{2,6})\b/gi,
      /\berro[:\s#]+(\d{2,6})\b/gi,
      /\balarme[:\s#]+(\d{2,6})\b/gi,
      /\b(\d{3,4})\b/g,
    ];
    const found = new Set<string>();
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) found.add(match[1].toUpperCase());
    }
    return Array.from(found);
  },

  findFailureByCode: async (codigo: string): Promise<any[]> => {
    const sb = getSupabase();
    if (!sb || !codigo) return [];
    const { data, error } = await sb
      .from('failure_manuals')
      .select('codigo, descricao, causa_provavel, acao_tecnica, equipamento, marca, modelo')
      .eq('codigo', codigo.trim())
      .limit(5);
    if (error) { console.warn('[findFailureByCode]', error.message); return []; }
    return data || [];
  },

  findFailuresByEquipment: async (equipamento: string, marca?: string, modelo?: string): Promise<any[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    let query = sb
      .from('failure_manuals')
      .select('codigo, descricao, causa_provavel, acao_tecnica, equipamento, marca, modelo')
      .order('created_at', { ascending: false })
      .limit(20);
    if (modelo?.trim())           query = query.ilike('modelo',      `%${modelo.trim()}%`);
    else if (marca?.trim())       query = query.ilike('marca',       `%${marca.trim()}%`);
    else if (equipamento?.trim()) query = query.ilike('equipamento', `%${equipamento.trim()}%`);
    const { data, error } = await query;
    if (error) { console.warn('[findFailuresByEquipment]', error.message); return []; }
    return data || [];
  },
};
