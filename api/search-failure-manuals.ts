// api/search-failure-manuals.ts
// Busca semântica via pgvector no failure_manuals
// Threshold 0.55 — reduz falsos negativos sem mudar a arquitetura

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
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (!supabase || !openai) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
  }

  const {
    relato,
    threshold = 0.55,
    marca,
    modelo,
    limit = 5,
  } = req.body as {
    relato: string;
    threshold?: number;
    marca?: string;
    modelo?: string;
    limit?: number;
  };

  if (!relato?.trim()) {
    return res.status(400).json({ error: 'relato é obrigatório' });
  }

  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: relato.trim(),
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    const { data: results, error } = await supabase.rpc('match_failure_manuals', {
      query_embedding:  queryEmbedding,
      match_threshold:  threshold,
      match_count:      limit,
      filter_marca:     marca  || null,
      filter_modelo:    modelo || null,
      filter_categoria: null,
    });

    if (error) {
      console.error('[search-failure-manuals] RPC error:', {
        message: error.message,
        code:    error.code,
        hint:    error.hint,
      });

      if (error.message?.includes('match_failure_manuals') || error.code === 'PGRST202') {
        console.warn('[search-failure-manuals] RPC não encontrada — execute migration_002_fix.sql no Supabase');
        return res.status(200).json({
          success: false,
          results: [],
          encontrou: false,
          error: 'RPC não encontrada. Execute a migration no Supabase.',
        });
      }

      return res.status(500).json({ error: error.message });
    }

    const topScore = typeof results?.[0]?.similaridade === 'number'
      ? `${(results[0].similaridade * 100).toFixed(1)}%`
      : 'N/A';
    console.log(`[search] "${relato.slice(0, 50)}" → ${results?.length ?? 0} resultado(s) | top score: ${topScore} | threshold: ${threshold}`);

    return res.status(200).json({
      success: true,
      results: results || [],
      encontrou: (results?.length ?? 0) > 0,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[search-failure-manuals]', message);
    return res.status(500).json({ error: message });
  }
}
