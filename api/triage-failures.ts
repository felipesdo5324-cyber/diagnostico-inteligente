// api/triage-failures.ts
// Etapa 3 do híbrido — só chamada quando semântica não encontrar (similaridade < 0.65)
// Usa gpt-4o-mini: barato, rápido, suficiente para extração de sintomas

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }
  if (!openai) {
    return res.status(500).json({ success: false, error: 'OpenAI não configurado' });
  }

  const { relato, equipamento, marca, modelo } = req.body as {
    relato: string;
    equipamento?: string;
    marca?: string;
    modelo?: string;
  };

  if (!relato?.trim()) {
    return res.status(400).json({ success: false, error: 'relato é obrigatório' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um engenheiro sênior de triagem de falhas industriais.
Leia relatos de técnicos de campo (com gírias, abreviações e linguagem informal) e identifique os problemas técnicos.

CONTEXTO: Equipamento: ${equipamento || '?'} | Marca: ${marca || '?'} | Modelo: ${modelo || '?'}

ABREVIAÇÕES COMUNS: bba=bomba, temp=temperatura, press=pressão, ger=gerador,
comp=compressor, mot=motor, tava=estava, tb=também, ñ=não, pq=porque,
trocou=substituiu, bateu=acionou/disparou, apagou=desligou, travou=travou/bloqueou

REGRAS:
1. Identifique TODOS os sintomas, mesmo implícitos
2. Mapeie para códigos de falha oficiais da marca/modelo se souber
3. Se não souber o código, retorne string vazia para aquele sintoma
4. Normalize termos para linguagem técnica oficial
5. Retorne APENAS JSON válido

FORMATO:
{
  "codigos": ["1434", "151"],
  "sintomasIdentificados": ["Parada de emergência acionada", "Alta temperatura"],
  "termosNormalizados": { "equipamento": "Grupo Gerador", "marca": "Cummins", "modelo": "PCC1302" }
}`
        },
        {
          role: 'user',
          content: `RELATO: "${relato}"\n\nExtraia os códigos e sintomas técnicos.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 400,
    });

    const content = response.choices[0].message.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      return res.status(500).json({ success: false, error: 'Resposta inválida da triagem' });
    }

    console.log(`[triage] Códigos: ${JSON.stringify(parsed.codigos)} | Sintomas: ${parsed.sintomasIdentificados?.length}`);

    return res.status(200).json({
      success: true,
      codigos: Array.isArray(parsed.codigos)
        ? parsed.codigos.filter((c: any) => typeof c === 'string' && c.trim()) : [],
      sintomasIdentificados: Array.isArray(parsed.sintomasIdentificados)
        ? parsed.sintomasIdentificados : [],
      termosNormalizados: {
        equipamento: parsed.termosNormalizados?.equipamento || equipamento || '',
        marca:       parsed.termosNormalizados?.marca       || marca       || '',
        modelo:      parsed.termosNormalizados?.modelo      || modelo      || '',
      },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[triage]', message);
    return res.status(500).json({ success: false, error: message });
  }
}