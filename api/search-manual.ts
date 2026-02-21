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
    // 1. Gera embedding da query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Tenta busca híbrida (vetorial + full-text)
    // Requer match_manual_sections_hybrid no Supabase (ver README para SQL)
    const { data: hybridData, error: hybridError } = await supabase.rpc(
      'match_manual_sections_hybrid',
      {
        query_embedding: queryEmbedding,
        text_query: query,
        match_manual_id: manualId,
        match_count: topK,
        semantic_weight: 0.7,
        fulltext_weight: 0.3,
      }
    );

    if (!hybridError && hybridData?.length) {
      console.log('[search-manual] Busca híbrida OK, chunks:', hybridData.length);
      const chunks: string[] = hybridData.map((row: any) => row.content);
      return res.status(200).json({ chunks, mode: 'hybrid' });
    }

    // 3. Fallback: busca vetorial pura (match_manual_sections)
    console.warn('[search-manual] Híbrida falhou, usando vetorial pura. Erro:', hybridError?.message);
    const { data: vectorData, error: vectorError } = await supabase.rpc(
      'match_manual_sections',
      {
        query_embedding: queryEmbedding,
        match_manual_id: manualId,
        match_count: topK,
      }
    );

    if (vectorError) {
      console.error('Erro na busca vetorial:', vectorError);
      return res.status(500).json({ error: vectorError.message });
    }

    const chunks: string[] = (vectorData || []).map((row: any) => row.content);
    return res.status(200).json({ chunks, mode: 'vector' });
  } catch (err: any) {
    console.error('Erro em search-manual:', err);
    return res.status(500).json({ error: err?.message ?? 'Erro interno' });
  }
}
