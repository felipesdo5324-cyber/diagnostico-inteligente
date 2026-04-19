// api/search-failure-manuals.ts
// Etapa 2 do híbrido — busca semântica via pgvector
// Threshold padrão: 0.65 (captura linguagem informal e variações técnicas)

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
    threshold = 0.65,   // 0.65 captura linguagem informal sem gerar ruído excessivo
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
    // Gera embedding do relato do técnico
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: relato.trim(),
    });

    const { data: results, error } = await supabase.rpc('match_failure_manuals', {
      query_embedding:  embeddingResponse.data[0].embedding,
      match_threshold:  threshold,
      match_count:      limit,
      filter_marca:     marca  || null,
      filter_modelo:    modelo || null,
      filter_categoria: null,
    });

    if (error) {
      console.error('[search-failure-manuals] RPC error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    const topSimilaridade = results?.[0]?.similaridade?.toFixed(2) ?? 'N/A';
    console.log(`[search] "${relato.slice(0, 40)}..." → ${results?.length ?? 0} resultado(s), top: ${topSimilaridade}`);

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