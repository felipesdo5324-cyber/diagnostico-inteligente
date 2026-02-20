import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const createChunks = (text: string, size = 1000, overlap = 150) => {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    chunks.push(text.slice(cursor, cursor + size));
    cursor += Math.max(1, size - overlap);
  }
  return chunks;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Handler iniciado, method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Metodo nao permitido' });
  }

  if (!supabase || !openai) {
    return res.status(500).json({ success: false, error: 'Variaveis de ambiente do backend nao configuradas.' });
  }

  try {
    const body = req.body as {
      filePath?: string;
      fileUrl?: string;
      fileName?: string;
      equipmentId?: string;
    };

    const { filePath, fileUrl, fileName, equipmentId } = body;

    if (!filePath || !equipmentId) {
      return res.status(400).json({ success: false, error: 'filePath e equipmentId sao obrigatorios' });
    }

    console.log('Baixando arquivo do Storage:', filePath);

    // Baixa o arquivo diretamente do Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('tecnoloc_assets')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Erro ao baixar arquivo', downloadError);
      return res.status(500).json({ success: false, error: downloadError?.message ?? 'Erro ao baixar arquivo' });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    console.log('Processando PDF, tamanho:', fileBuffer.length);

    const pdfResult = await pdfParse(fileBuffer);
    const fullText = pdfResult.text?.trim() ?? '';

    if (!fullText) {
      return res.status(400).json({ success: false, error: 'Nao foi possivel extrair texto do PDF' });
    }

    const chunks = createChunks(fullText);
    console.log('Total de chunks:', chunks.length);

    if (!chunks.length) {
      return res.status(400).json({ success: false, error: 'Nao foi possivel criar segmentos do conteudo' });
    }

    // Salva o manual no banco
    const { data: manualData, error: manualError } = await supabase
      .from('manuals')
      .insert({
        equipment_id: equipmentId,
        file_path: filePath,
        file_url: fileUrl ?? null,
        file_name: fileName ?? null,
      })
      .select()
      .single();

    if (manualError || !manualData) {
      console.error('Erro ao inserir manual', manualError);
      return res.status(500).json({ success: false, error: manualError?.message ?? 'Erro ao salvar manual' });
    }

    console.log('Gerando embeddings, chunks:', chunks.length);

    // Processa em lotes de 100 para evitar timeout
    const BATCH_SIZE = 100;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchChunks = chunks.slice(batchStart, batchStart + BATCH_SIZE);

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batchChunks,
      });

      for (let i = 0; i < batchChunks.length; i++) {
        const embedding = embeddingResponse.data[i]?.embedding;
        if (!embedding || embedding.length !== 1536) {
          return res.status(500).json({ success: false, error: `Embedding invalido no chunk ${batchStart + i}` });
        }

        const { error: sectionError } = await supabase
          .from('manual_sections')
          .insert({
            manual_id: manualData.id,
            equipment_id: equipmentId,
            content: batchChunks[i],
            embedding,
          });

        if (sectionError) {
          console.error('Erro ao inserir chunk', sectionError);
          return res.status(500).json({ success: false, error: sectionError.message });
        }
      }
    }

    return res.status(200).json({
      success: true,
      manualId: manualData.id,
      fileUrl: fileUrl ?? null,
      fileName: fileName ?? null,
    });
  } catch (error: any) {
    console.error('Erro no processamento:', error);
    return res.status(500).json({ success: false, error: error?.message ?? 'Erro interno' });
  }
}
