import OpenAI from "openai";
import { DiagnosticResult } from "../types";
import { supabase } from "./supabase";

const getCredential = (key: string): string | undefined => {
  const viteKey = `VITE_${key}`;
  return (process.env as any)[key] ||
         (process.env as any)[viteKey] ||
         (import.meta as any).env?.[viteKey] ||
         (import.meta as any).env?.[key];
};

const apiKey = getCredential('OPENAI_API_KEY');

const openai = new OpenAI({
  apiKey: apiKey || 'dummy',
  dangerouslyAllowBrowser: true
});

function forceString(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const priorityKeys = ['text', 'description', 'desc', 'item', 'causa', 'valor', 'value', 'passo', 'step', 'instrucao'];
    for (const key of priorityKeys) {
      if (val[key] && typeof val[key] === 'string') return val[key];
    }
    const firstStringKey = Object.keys(val).find(k => typeof val[k] === 'string');
    if (firstStringKey) return val[firstStringKey];
    return JSON.stringify(val);
  }
  return String(val);
}

function sanitizeResult(data: any): DiagnosticResult {
  const result: DiagnosticResult = { possible_causes: [], solutions: [] };
  if (!data || typeof data !== 'object') return result;

  const rawCauses = Array.isArray(data.possible_causes) ? data.possible_causes :
                   Array.isArray(data.causas) ? data.causas : [];
  result.possible_causes = rawCauses.map(forceString).filter((s: string) => s.trim() !== '');

  const rawSolutions = Array.isArray(data.solutions) ? data.solutions :
                      Array.isArray(data.solucoes) ? data.solucoes : [];

  result.solutions = rawSolutions.map((s: any) => {
    if (typeof s === 'string') {
      return { title: 'Ação Corretiva', steps: [s], difficulty: 'Média' as const };
    }
    const title = forceString(s.title || s.titulo || s.nome || 'Solução Técnica');
    const steps = Array.isArray(s.steps) ? s.steps :
                 Array.isArray(s.passos) ? s.passos : [forceString(s.steps || s.passos)];
    let difficulty: 'Fácil' | 'Média' | 'Difícil' = 'Média';
    const d = forceString(s.difficulty || s.dificuldade).toLowerCase();
    if (d.includes('fácil') || d.includes('facil') || d.includes('easy')) difficulty = 'Fácil';
    if (d.includes('difícil') || d.includes('dificil') || d.includes('hard')) difficulty = 'Difícil';
    return {
      title,
      steps: steps.map(forceString).filter((st: string) => st.trim() !== ''),
      difficulty
    };
  });

  if (result.possible_causes.length === 0) {
    result.possible_causes = ['Realizar inspeção técnica completa para identificar a causa raiz.'];
  }
  if (result.solutions.length === 0) {
    result.solutions = [{
      title: 'Verificação Padrão',
      steps: [
        'Realizar inspeção visual completa do equipamento',
        'Verificar conexões elétricas e hidráulicas',
        'Validar níveis de fluidos e pressões operacionais'
      ],
      difficulty: 'Fácil'
    }];
  }
  return result;
}

export const aiService = {
  analyzeEquipment: async (
    equipmentInfo: { name: string; brand: string; model: string; defect: string; category: string },
    manualContent: string | null,
    previousSolutions: string | null,
    imageBase64: string | null,
    manualId?: string | null
  ): Promise<DiagnosticResult> => {

    if (!apiKey) {
      throw new Error("Chave de API da OpenAI não configurada (OPENAI_API_KEY).");
    }

    // ── RAG via pgvector nos manual_sections ──────────────────────────────────
    let ragContext = "";

    try {
      const enrichedQuery = [
        equipmentInfo.defect,
        equipmentInfo.name,
        equipmentInfo.brand,
        equipmentInfo.model,
        equipmentInfo.category
      ].filter(Boolean).join(" — ");

      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: enrichedQuery
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      if (manualId) {
        const { data: ragResults, error: ragError } = await supabase.rpc(
          "match_manual_sections_hybrid",
          {
            query_embedding: queryEmbedding,
            text_query: enrichedQuery,
            match_manual_id: manualId,
            match_count: 10
          }
        );

        if (!ragError && ragResults && ragResults.length > 0) {
          ragContext = ragResults
            .map((r: any, i: number) => {
              const header = r.section_title
                ? `[Seção ${i + 1} — ${r.section_title}${r.page_number ? `, p.${r.page_number}` : ''}]`
                : `[Seção ${i + 1}]`;
              return `${header}\n${r.content}`;
            })
            .join("\n\n---\n\n");
        }
      }
    } catch (ragErr: any) {
      console.warn("[aiService] RAG falhou (não crítico):", ragErr.message);
    }

    // Contexto final: failure_manuals + RAG de manual técnico
    const finalManualContext = ragContext || manualContent || "";

    // ── DETECTA O TIPO DE CONTEXTO para ajustar o prompt ────────────────────
    // Se o contexto vem do failure_manuals (tem "MANUAL DE FALHAS"), não exige citação de trechos
    const isFailureManualContext = finalManualContext.includes('MANUAL DE FALHAS') ||
                                   finalManualContext.includes('CÓDIGO:') ||
                                   finalManualContext.includes('CAUSA PROVÁVEL:');

    const isRAGContext = ragContext.length > 0;

    const systemInstruction = `Você é um sistema de diagnóstico técnico industrial da Tecnoloc, especializado em geradores, torres de iluminação e compressores.

${finalManualContext
  ? `╔══════════════════════════════════════════════════════════╗
   BASE DE CONHECIMENTO TÉCNICO
╚══════════════════════════════════════════════════════════╝

${finalManualContext}

${isRAGContext ? `╔══════════════════════════════════════════════════════════╗
   REGRAS DE RESPOSTA — USE APENAS O CONTEÚDO ACIMA
╚══════════════════════════════════════════════════════════╝
1. Use APENAS as informações dos trechos fornecidos acima.
2. Seja específico: use os valores exatos (pressão, tensão, torque, temperatura) do documento.
3. Se o documento mencionar um código de erro, inclua-o na resposta.
4. Se os trechos não contiverem informação suficiente, diga isso claramente.
5. NÃO invente dados que não estejam no documento.` :
`╔══════════════════════════════════════════════════════════╗
   REGRAS DE RESPOSTA
╚══════════════════════════════════════════════════════════╝
1. Use as informações do manual de falhas acima como base principal.
2. Seja específico com as causas e ações técnicas fornecidas.
3. Complemente com conhecimento técnico geral se necessário.
4. Não invente procedimentos que contradigam o manual.`}`
  : `BASE DE CONHECIMENTO: Não disponível para este equipamento/modelo.
Utilize conhecimento técnico geral de manutenção industrial, sendo transparente sobre isso.`}

${previousSolutions
  ? `=== EXPERIÊNCIAS ANTERIORES DE CAMPO ===
${previousSolutions}
===`
  : ''}

REGRAS DE SAÍDA OBRIGATÓRIAS:
1. Forneça pelo menos 3 causas prováveis REAIS e específicas (nunca use placeholders como [TRECHO X]).
2. Cada solução deve ter NO MÍNIMO 3 passos concretos de ação.
3. O campo 'difficulty' deve ser: 'Fácil', 'Média' ou 'Difícil'.
4. Escreva em português técnico claro.
5. As causas devem ser descrições reais, não referências a documentos.

FORMATO DE SAÍDA (JSON válido, sem texto fora do JSON):
{
  "possible_causes": [
    "Descrição real da causa 1",
    "Descrição real da causa 2",
    "Descrição real da causa 3"
  ],
  "solutions": [
    {
      "title": "Nome do procedimento de resolução",
      "steps": [
        "Passo 1 com instrução concreta",
        "Passo 2 com instrução concreta",
        "Passo 3 com instrução concreta"
      ],
      "difficulty": "Fácil"
    }
  ]
}`;

    const userPrompt = `EQUIPAMENTO: ${equipmentInfo.name} (${equipmentInfo.brand} ${equipmentInfo.model})
CATEGORIA DO DEFEITO: ${equipmentInfo.category.toUpperCase()}
DEFEITO RELATADO: "${equipmentInfo.defect}"

Gere um diagnóstico técnico com causas prováveis reais e plano de ação detalhado.`;

    const imageNote = imageBase64
      ? `\n\nOBS.: Foi anexada uma foto do defeito/alarme. Use como referência adicional.`
      : '';

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `${userPrompt}${imageNote}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2048,
      });

      const text = response.choices[0].message.content;
      if (!text) throw new Error("A IA retornou uma resposta vazia.");

      const parsed = JSON.parse(text);
      return sanitizeResult(parsed);

    } catch (error: any) {
      console.error("Erro crítico OpenAI Service:", error);
      throw new Error(`Falha no Diagnóstico GPT-4o: ${error.message}`);
    }
  },
};