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
    const { filePath, photoUrl, equipamento, marca, modelo, categoria } = req.body as {
      filePath: string;
      photoUrl?: string;
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

    if (!fullText && !photoUrl) {
      return res.status(400).json({ success: false, error: 'Não foi possível extrair texto do PDF e não foi enviada imagem do alarme.' });
    }

    const prompt = `Você é um assistente técnico multimodal especialista em diagnóstico de falhas e resolução de problemas de equipamentos.
Leia cuidadosamente o conteúdo do PDF e, se for enviada, também a imagem do alarme.
Extraia as falhas e suas resoluções exatamente como aparecem no manual, sem inventar nada.
Se houver termos, códigos ou instruções específicas no manual, mantenha a terminologia exata.
Se a imagem complementar indicar um alarme ou sintoma, correlate essa informação com a falha extraída do manual.

Retorne apenas JSON válido com um array chamado "failures".
Cada item deve conter:
- titulo: título curto e descritivo da falha conforme o manual
- falha: descrição completa do sintoma ou comportamento anormal
- resolucao: passos de resolução detalhados ou procedimento técnico do manual

NÃO inclua texto fora do JSON. NÃO insira comentários, explicações ou campos extras.

EQUIPAMENTO: ${equipamento}
MARCA: ${marca || 'Não informada'}
MODELO: ${modelo}
CATEGORIA: ${categoria}

${fullText ? `CONTEÚDO DO PDF:\n${fullText}` : 'O PDF não contém texto legível.'}`;

    const userMessageContent = photoUrl
      ? [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: photoUrl }
        ]
      : prompt;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Extraia falhas/resoluções do manual em formato JSON conforme contrato.' },
        { role: 'user', content: userMessageContent },
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
