import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }
  if (!supabase || !openai) {
    return res.status(500).json({ error: 'Variaveis de ambiente nao configuradas.' });
  }

  const { query, manualId, topK = 10 } = req.body as {
    query?: string;
    manualId?: string;
    topK?: number;
  };

  if (!query || !manualId) {
    return res.status(400).json({ error: 'query e manualId sao obrigatorios' });
  }

  try {
    // 1. Gera embedding da query (descrição do defeito)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Busca os chunks mais similares via pgvector no Supabase
    const { data, error } = await supabase.rpc('match_manual_sections', {
      query_embedding: queryEmbedding,
      match_manual_id: manualId,
      match_count: topK,
    });

    if (error) {
      console.error('Erro na busca vetorial:', error);
      return res.status(500).json({ error: error.message });
    }

    const chunks: string[] = (data || []).map((row: any) => row.content);
    return res.status(200).json({ chunks });
  } catch (err: any) {
    console.error('Erro em search-manual:', err);
    return res.status(500).json({ error: err?.message ?? 'Erro interno' });
  }
}
