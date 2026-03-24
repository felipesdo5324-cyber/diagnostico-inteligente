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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Metodo nao permitido' });
  }

  if (!supabase || !openai) {
    return res.status(500).json({ success: false, error: 'Variaveis de ambiente nao configuradas.' });
  }

  try {
    const { manualId, filePath, equipmentId } = req.body as {
      manualId?: string;
      filePath?: string;
      equipmentId?: string;
    };

    if (!manualId || !filePath) {
      return res.status(400).json({ success: false, error: 'manualId e filePath sao obrigatorios' });
    }

    // equipmentId so e usado se for um UUID valido
    const validEquipmentId = equipmentId && UUID_REGEX.test(equipmentId) ? equipmentId : null;

    console.log('Baixando arquivo do Storage:', filePath);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('tecnoloc_assets')
      .download(filePath);

    if (downloadError || !fileData) {
      return res.status(500).json({ success: false, error: downloadError?.message ?? 'Erro ao baixar arquivo' });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    console.log('Processando PDF, bytes:', fileBuffer.length);

    const pdfResult = await pdfParse(fileBuffer);
    const fullText = pdfResult.text?.trim() ?? '';

    if (!fullText) {
      return res.status(400).json({ success: false, error: 'Nao foi possivel extrair texto do PDF' });
    }

    const chunks = createChunks(fullText);
    console.log('Chunks gerados:', chunks.length);

    const BATCH_SIZE = 100;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batch = chunks.slice(batchStart, batchStart + BATCH_SIZE);

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });

      for (let i = 0; i < batch.length; i++) {
        const embedding = embeddingResponse.data[i]?.embedding;
        if (!embedding || embedding.length !== 1536) {
          return res.status(500).json({ success: false, error: `Embedding invalido no chunk ${batchStart + i}` });
        }

        const row: Record<string, unknown> = {
          manual_id: manualId,
          content: batch[i],
          embedding,
        };
        if (validEquipmentId) row.equipment_id = validEquipmentId;

        const { error: sectionError } = await supabase
          .from('manual_sections')
          .insert(row);

        if (sectionError) {
          console.error('Erro ao inserir chunk', sectionError);
          return res.status(500).json({ success: false, error: sectionError.message });
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Erro no processamento:', error);
    return res.status(500).json({ success: false, error: error?.message ?? 'Erro interno' });
  }
}
