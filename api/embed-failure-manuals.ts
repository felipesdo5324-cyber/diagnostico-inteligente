// api/embed-failure-manuals.ts
// Gera embeddings para registros da failure_manuals sem embedding
// Chamado automaticamente após saveFailureManual (background)
// Chamado manualmente para backfill dos registros antigos

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Texto embeddado com contexto rico dos campos mais úteis para diagnóstico.
function buildEmbedText(row: any): string {
  return `
Falha: ${row.descricao || row.falha || ''}

Causa provável: ${row.causa_provavel || ''}

Solução: ${row.acao_tecnica || row.resolucao || ''}

Equipamento: ${row.equipamento || ''}
Marca: ${row.marca || ''}
Modelo: ${row.modelo || ''}
`.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (!supabase || !openai) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
  }

  const { id } = req.body as { id?: string };

  try {
    // Se id específico → processa só ele; senão → backfill em lote
    const query = id
      ? supabase.from('failure_manuals')
          .select('id, codigo, descricao, causa_provavel, acao_tecnica, falha, resolucao, equipamento, marca, modelo')
          .eq('id', id)
      : supabase.from('failure_manuals')
          .select('id, codigo, descricao, causa_provavel, acao_tecnica, falha, resolucao, equipamento, marca, modelo')
          .is('embedding', null)
          .limit(50);

    const { data: rows, error: fetchError } = await query;
    if (fetchError) return res.status(500).json({ error: fetchError.message });
    if (!rows || rows.length === 0) {
      return res.status(200).json({ success: true, processed: 0, message: 'Nenhum registro pendente.' });
    }

    console.log(`[embed] Processando ${rows.length} registro(s)...`);

    const texts = rows.map(buildEmbedText);

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    let saved = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const { error: updateError } = await supabase
        .from('failure_manuals')
        .update({ embedding: embeddingResponse.data[i].embedding })
        .eq('id', rows[i].id);

      if (updateError) { errors++; console.error(`[embed] Erro ${rows[i].id}:`, updateError.message); }
      else saved++;
    }

    console.log(`[embed] ${saved} salvos, ${errors} erros`);
    return res.status(200).json({ success: true, processed: rows.length, saved, errors });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[embed]', message);
    return res.status(500).json({ error: message });
  }
}
