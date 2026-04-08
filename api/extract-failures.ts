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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  if (!supabase || !openai) {
    return res.status(500).json({ success: false, error: 'Variáveis de ambiente não configuradas.' });
  }

  try {
    const { filePath, equipamento, marca, modelo, categoria } = req.body as {
      filePath: string;
      equipamento: string;
      marca?: string;
      modelo: string;
      categoria: 'eletrica' | 'mecanica';
    };

    if (!filePath || !equipamento || !modelo || !categoria) {
      return res.status(400).json({ success: false, error: 'filePath, equipamento, modelo e categoria são obrigatórios' });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('tecnoloc_assets')
      .download(filePath);

    if (downloadError || !fileData) {
      return res.status(500).json({ success: false, error: downloadError?.message ?? 'Erro ao baixar arquivo' });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const pdfResult = await pdfParse(buffer);
    const fullText = pdfResult.text?.trim() ?? '';

    if (!fullText) {
      return res.status(400).json({ success: false, error: 'Não foi possível extrair texto do PDF' });
    }

    const prompt = `Você é um assistente técnico para extração.
Baseado no texto abaixo extraído do PDF, devolva apenas JSON válido com um array chamado "failures".
Cada item deve conter: titulo, falha, resolucao.
Não inclua explicações, texto adicional ou qualquer outro campo fora do JSON.

EQUIPAMENTO: ${equipamento}
MARCA: ${marca || 'Não informada'}
MODELO: ${modelo}
CATEGORIA: ${categoria}

CONTEÚDO:
${fullText}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Extraia falhas/resoluções do manual em formato JSON conforme contrato.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 1800,
    });

    const content = completion.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : content;

    if (!content) {
      return res.status(500).json({ success: false, error: 'IA retornou resposta vazia.' });
    }

    let parsed: any = null;
    if (typeof content === 'object') {
      parsed = content;
    } else {
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (nestedError) {
            console.error('Erro ao parsear JSON após extração:', nestedError, 'conteúdo:', content);
          }
        }
      }
    }

    if (!parsed || !Array.isArray(parsed.failures)) {
      console.error('Resposta inválida da IA:', content);
      return res.status(500).json({ success: false, error: 'Resposta da IA não era JSON válido.' });
    }

    const failures: Array<{ titulo: string; falha: string; resolucao: string }> = parsed.failures;

    if (failures.length === 0) {
      return res.status(400).json({ success: false, error: 'IA não extraiu falhas do PDF.' });
    }

    return res.status(200).json({ success: true, failures });
  } catch (error: any) {
    console.error('Erro no extract-failures:', error);
    return res.status(500).json({ success: false, error: error?.message ?? 'Erro interno' });
  }
}
