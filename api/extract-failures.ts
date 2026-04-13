// api/extract-failures.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

// ----------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------
interface FailureItem {
  codigo: string | null;
  descricao: string;
  causa_provavel: string;
  acao_tecnica: string;
}

interface RequestBody {
  filePath: string;
  fileUrl?: string;
  photoUrl?: string;
  equipamento: string;
  marca?: string;
  modelo: string;
  categoria: 'eletrica' | 'mecanica';
}

// ----------------------------------------------------------------
// CLIENTES (inicialização segura)
// ----------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// ----------------------------------------------------------------
// LIMITES
// ----------------------------------------------------------------
const MAX_TEXT_CHARS = 30_000; // ~7.500 tokens — seguro para gpt-4o (128k ctx)
const MAX_TOKENS_RESPONSE = 4_000; // suficiente para até ~40 falhas detalhadas

// ----------------------------------------------------------------
// LIMPEZA DE TEXTO EXTRAÍDO DO PDF
// Resolve: \u0000 onde deveriam estar números, palavras cortadas na virada de página
// ----------------------------------------------------------------
function cleanPdfText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')                          // null chars de encoding corrompido
    .replace(/-\n([a-záàâãéêíóôõúüA-Z])/g, '$1')    // une palavras cortadas na virada de página
    .replace(/([^\.\:\!\?])\n([a-záàâãéêíóôõúü])/g, '$1 $2') // une linhas do mesmo parágrafo
    .replace(/[ \t]{2,}/g, ' ')                      // normaliza espaços múltiplos
    .replace(/\n{3,}/g, '\n\n')                      // máximo 2 quebras consecutivas
    .trim();
}

// ----------------------------------------------------------------
// PARSE SEGURO DO JSON DA IA
// ----------------------------------------------------------------
function parseAIResponse(content: string): { failures: FailureItem[] } | null {
  // Tentativa 1: parse direto
  try {
    return JSON.parse(content);
  } catch (_) {}

  // Tentativa 2: extrai o bloco JSON do texto (caso a IA adicione explicação)
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) {}
  }

  return null;
}

// ----------------------------------------------------------------
// HANDLER PRINCIPAL
// ----------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  if (!supabase || !openai) {
    return res.status(500).json({ success: false, error: 'Variáveis de ambiente não configuradas.' });
  }

  try {
    const {
      filePath,
      photoUrl,
      equipamento,
      marca,
      modelo,
      categoria,
    } = req.body as RequestBody;

    // Validação de campos obrigatórios
    if (!filePath || !equipamento || !modelo || !categoria) {
      return res.status(400).json({
        success: false,
        error: 'filePath, equipamento, modelo e categoria são obrigatórios',
      });
    }

    // ── 1. Download do PDF do Supabase Storage ──────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('tecnoloc_assets')
      .download(filePath);

    if (downloadError || !fileData) {
      return res.status(500).json({
        success: false,
        error: downloadError?.message ?? 'Erro ao baixar arquivo do storage',
      });
    }

    // ── 2. Extração e limpeza do texto do PDF ───────────────────
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const pdfResult = await pdfParse(buffer);
    const rawText = pdfResult.text?.trim() ?? '';
    const cleanText = cleanPdfText(rawText);

    console.log(`[extract-failures] PDF extraído: ${cleanText.length} chars (raw: ${rawText.length})`);

    if (!cleanText && !photoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Não foi possível extrair texto do PDF e nenhuma imagem de alarme foi enviada.',
      });
    }

    // Trunca se necessário — evita estourar o context window e custo excessivo
    const textForPrompt = cleanText.length > MAX_TEXT_CHARS
      ? cleanText.slice(0, MAX_TEXT_CHARS) + '\n\n[... texto truncado por limite de tamanho ...]'
      : cleanText;

    // ── 3. Monta prompt ─────────────────────────────────────────
    const systemPrompt = `Você é um engenheiro técnico especializado em análise de manuais de equipamentos industriais.

MISSÃO: Extrair TODAS as falhas documentadas no manual com máxima fidelidade.

REGRAS OBRIGATÓRIAS:
1. Procure códigos de falha em tabelas, colunas e próximo a descrições (ex: "121 - Perda de Sinal")
2. Formatos de código: numérico (121), alfanumérico (P0123, E001, F-10) ou null se ausente
3. Para cada falha extraia: código, descrição, causa raiz e ação técnica completa
4. Não invente dados — use apenas o que está no manual
5. Se o manual tiver seções de dicas ou avisos gerais, inclua como falha com codigo: null
6. Retorne APENAS JSON válido no formato especificado, sem texto adicional`;

    const userPrompt = `Extraia TODAS as falhas do manual abaixo.

EQUIPAMENTO: ${equipamento}
MARCA: ${marca ?? 'Não informada'}
MODELO: ${modelo}
CATEGORIA: ${categoria}

${textForPrompt ? `CONTEÚDO DO PDF:\n${textForPrompt}` : 'PDF sem texto legível — analise pela imagem do alarme.'}

Retorne SOMENTE este JSON:
{
  "failures": [
    {
      "codigo": "código ou null",
      "descricao": "nome da falha",
      "causa_provavel": "causa raiz detalhada",
      "acao_tecnica": "passos de diagnóstico e resolução"
    }
  ]
}`;

    // ── 4. Monta mensagem multimodal (texto + imagem opcional) ──
    type MessageContent =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'high' } };

    const userContent: MessageContent[] = [{ type: 'text', text: userPrompt }];

    if (photoUrl) {
      userContent.push({
        type: 'image_url',
        image_url: { url: photoUrl, detail: 'high' },
      });
    }

    // ── 5. Chamada ao GPT-4o ────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,              // baixo = mais determinístico para extração
      response_format: { type: 'json_object' },
      max_tokens: MAX_TOKENS_RESPONSE,
    });

    const rawContent = completion.choices?.[0]?.message?.content ?? '';

    console.log(`[extract-failures] Resposta IA (${rawContent.length} chars):`, rawContent.slice(0, 300));

    // ── 6. Parse da resposta ────────────────────────────────────
    const parsed = parseAIResponse(rawContent);

    if (!parsed || !Array.isArray(parsed.failures)) {
      console.error('[extract-failures] Estrutura inválida:', rawContent);
      return res.status(500).json({
        success: false,
        error: 'Resposta da IA com estrutura inválida.',
      });
    }

    const failures: FailureItem[] = parsed.failures;

    if (failures.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'A IA não encontrou falhas no conteúdo fornecido.',
      });
    }

    console.log(`[extract-failures] ${failures.length} falhas extraídas com sucesso`);

    // ── 7. Retorna para o frontend salvar ───────────────────────
    // NOTA: O save no banco deve ocorrer aqui no backend para garantir atomicidade.
    // Se o seu frontend faz o save separadamente, considere mover a inserção para cá
    // passando também o failure_manual_id nesta requisição.
    return res.status(200).json({
      success: true,
      failures,
      meta: {
        totalFailures: failures.length,
        pdfChars: cleanText.length,
        truncated: cleanText.length > MAX_TEXT_CHARS,
        withImage: !!photoUrl,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno desconhecido';
    console.error('[extract-failures] Erro crítico:', message);
    return res.status(500).json({ success: false, error: message });
  }
}