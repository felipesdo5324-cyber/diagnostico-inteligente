import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

type MultimodalContent =
  | string
  | Array<
      | { type: 'input_text'; text: string }
      | { type: 'input_image'; image_url: string }
    >;

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
    return res.status(405).json({ success: false, error: 'MÃ©todo nÃ£o permitido' });
  }

  if (!supabase || !openai) {
    return res.status(500).json({ success: false, error: 'VariÃ¡veis de ambiente nÃ£o configuradas.' });
  }

  try {
    const { filePath, fileUrl, photoUrl, equipamento, marca, modelo, categoria } = req.body as {
      filePath: string;
      fileUrl?: string;
      photoUrl?: string;
      equipamento: string;
      marca?: string;
      modelo: string;
      categoria: 'eletrica' | 'mecanica';
    };

    if (!filePath || !equipamento || !modelo || !categoria) {
      return res.status(400).json({ success: false, error: 'filePath, equipamento, modelo e categoria sÃ£o obrigatÃ³rios' });
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
      return res.status(400).json({ success: false, error: 'NÃ£o foi possÃ­vel extrair texto do PDF e nÃ£o foi enviada imagem do alarme.' });
    }

    const prompt = `VocÃª Ã© um assistente tÃ©cnico multimodal especialista em diagnÃ³stico de falhas e resoluÃ§Ã£o de problemas de equipamentos.
Leia cuidadosamente o conteÃºdo do PDF e, se for enviada, tambÃ©m a imagem do alarme.
Extraia as falhas e suas resoluÃ§Ãµes exatamente como aparecem no manual, sem inventar nada.
Se houver termos, cÃ³digos ou instruÃ§Ãµes especÃ­ficas no manual, mantenha a terminologia exata.
Se a imagem complementar indicar um alarme ou sintoma, correlate essa informaÃ§Ã£o com a falha extraÃ­da do manual.

IMPORTANTE: Retorne APENAS o JSON abaixo, sem qualquer texto adicional antes ou depois.

{
  "failures": [
    {
      "titulo": "tÃ­tulo curto e descritivo da falha conforme o manual",
      "falha": "descriÃ§Ã£o completa do sintoma ou comportamento anormal",
      "resolucao": "passos de resoluÃ§Ã£o detalhados ou procedimento tÃ©cnico do manual"
    }
  ]
}

EQUIPAMENTO: ${equipamento}
MARCA: ${marca || 'NÃ£o informada'}
MODELO: ${modelo}
CATEGORIA: ${categoria}

${fullText ? `CONTEÃšDO DO PDF:\n${fullText}` : 'O PDF nÃ£o contÃ©m texto legÃ­vel.'}`;

    const userMessageContent: MultimodalContent = photoUrl
      ? [
          { type: 'input_text' as const, text: prompt },
          { type: 'input_image' as const, image_url: photoUrl }
        ]
      : prompt;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'VocÃª Ã© um assistente tÃ©cnico que extrai falhas e resoluÃ§Ãµes de manuais. Sempre retorne apenas JSON vÃ¡lido no formato exato especificado. Nunca inclua texto adicional fora do JSON.' },
        { role: 'user', content: userMessageContent as any },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 1800,
    });

    const content = completion.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : content;

    console.log('ðŸ” Resposta bruta da IA:', text);

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
        console.log('âŒ Primeiro parse falhou, tentando extrair JSON do texto...');
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
            console.log('âœ… JSON extraÃ­do com sucesso:', parsed);
          } catch (nestedError) {
            console.error('âŒ Mesmo apÃ³s extraÃ§Ã£o, JSON invÃ¡lido:', nestedError, 'conteÃºdo:', content);
            return res.status(500).json({ success: false, error: 'Resposta da IA nÃ£o era JSON vÃ¡lido.' });
          }
        } else {
          console.error('âŒ Nenhum JSON encontrado na resposta:', content);
          return res.status(500).json({ success: false, error: 'Resposta da IA nÃ£o era JSON vÃ¡lido.' });
        }
      }
    }

    if (!parsed || !Array.isArray(parsed.failures)) {
      console.error('âŒ Estrutura invÃ¡lida - parsed:', parsed, 'failures:', parsed?.failures);
      return res.status(500).json({ success: false, error: 'Resposta da IA nÃ£o era JSON vÃ¡lido.' });
    }

    const failures: Array<{ titulo: string; falha: string; resolucao: string }> = parsed.failures;

    if (failures.length === 0) {
      return res.status(400).json({ success: false, error: 'IA nÃ£o extraiu falhas do PDF.' });
    }

    return res.status(200).json({ success: true, failures });
  } catch (error: any) {
    console.error('Erro no extract-failures:', error);
    return res.status(500).json({ success: false, error: error?.message ?? 'Erro interno' });
  }
}




