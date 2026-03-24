import { createClient } from '@supabase/supabase-js';

// Busca as variáveis do seu arquivo .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as variáveis existem para evitar erros silenciosos
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Erro: Variáveis de ambiente do Supabase não encontradas!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'tecnoloc_supabase_auth',
  },
});
