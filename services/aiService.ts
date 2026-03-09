
import OpenAI from "openai";
import { DiagnosticResult } from "../types";
import { supabase } from "./supabase";

// Função auxiliar para buscar credenciais de forma robusta
const getCredential = (key: string): string | undefined => {
  const viteKey = `VITE_${key}`;
  return (process.env as any)[key] || 
         (process.env as any)[viteKey] || 
         (import.meta as any).env?.[viteKey] || 
         (import.meta as any).env?.[key];
};

const apiKey = getCredential('OPENAI_API_KEY');

const openai = new OpenAI({
  apiKey: apiKey || 'dummy', // Evita crash na inicialização se a key não existir imediatamente
  dangerouslyAllowBrowser: true // Permite uso no frontend conforme arquitetura atual
});

/**
 * Converte qualquer valor em uma string pura, extraindo conteúdo de objetos se necessário.
 * Crucial para evitar o erro visual [object Object] no frontend.
 */
function forceString(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    // Busca por chaves de conteúdo conhecidas em modelos de IA
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

/**
 * Normaliza a resposta da IA para o contrato DiagnosticResult.
 */
function sanitizeResult(data: any): DiagnosticResult {
  const result: DiagnosticResult = {
    possible_causes: [],
    solutions: []
  };

  if (!data || typeof data !== 'object') return result;

  // Normalização de Causas
  const rawCauses = Array.isArray(data.possible_causes) ? data.possible_causes :
                   Array.isArray(data.causas) ? data.causas : [];
  result.possible_causes = rawCauses.map(forceString).filter((s: string) => s.trim() !== '');

  // Normalização de Soluções
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

  // Garantia mínima de conteúdo
  if (result.possible_causes.length === 0) {
    result.possible_causes = ['Causa não identificada — realizar inspeção técnica completa.'];
  }
  if (result.solutions.length === 0) {
    result.solutions = [{
      title: 'Verificação Padrão Tecnoloc',
      steps: ['Realizar inspeção visual completa do equipamento', 'Checar conexões elétricas e hidráulicas', 'Validar níveis de fluidos e pressões operacionais'],
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

    // ── RAG: gerar embedding do defeito e buscar trechos relevantes no Supabase ─────
    let manualContext = "";

    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: equipmentInfo.defect
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      if (manualId) {
        const { data: ragResults, error: ragError } = await supabase.rpc(
          "match_manual_sections_hybrid",
          {
            query_embedding: queryEmbedding,
            text_query: equipmentInfo.defect,
            match_manual_id: manualId,
            match_count: 5
          }
        );

        if (ragError) {
          console.error("Erro na busca RAG:", ragError);
        } else if (ragResults && ragResults.length > 0) {
          manualContext = ragResults
            .map((r: any) => r.content)
            .join("\n\n");
        }
      }
    } catch (ragErr: any) {
      console.error("Falha no pipeline RAG (embedding/RPC):", ragErr.message);
    }

    // Fallback: se RAG não retornou nada, usa o manualContent recebido como parâmetro
    const finalManualContext = manualContext || manualContent || "";

    const systemInstruction = `Você é um Especialista Sênior em Manutenção e Diagnóstico de Máquinas da Tecnoloc, especializado em geradores, torres de iluminação e compressores. Sua função é analisar problemas técnicos relatados por operadores de campo e fornecer diagnósticos precisos e planos de ação seguros.

${finalManualContext
  ? `=== TRECHOS RELEVANTES DO MANUAL ===
${finalManualContext}
=== FIM DO MANUAL ===

DIRETRIZES DE USO DO MANUAL:
- Priorize sempre as informações do manual técnico acima.
- Referencie seções, códigos de erro ou tabelas do manual quando disponíveis.
- Cite valores técnicos exatos (pressões, tensões, torques) mencionados no manual.`
  : 'MANUAL TÉCNICO: Não disponível — utilize seu conhecimento de manutenção industrial para este equipamento.'}

${previousSolutions
  ? `=== EXPERIÊNCIAS ANTERIORES DE CAMPO ===
${previousSolutions}
===`
  : ''}

REGRAS DE OURO — SIGA OBRIGATORIAMENTE:
1. Forneça pelo menos 3 causas prováveis.
2. Cada solução deve ser um plano detalhado com NO MÍNIMO 3 passos claros.
3. Use terminologia técnica precisa mas instruções práticas para o canteiro de obras.
4. O campo 'difficulty' deve ser obrigatoriamente: 'Fácil', 'Média' ou 'Difícil'.

FORMATO OBRIGATÓRIO (JSON válido, sem texto fora do JSON):
{
  "possible_causes": ["Causa 1", "Causa 2", "Causa 3"],
  "solutions": [
    {
      "title": "Título da Solução",
      "steps": ["Passo 1", "Passo 2", "Passo 3"],
      "difficulty": "Fácil"
    }
  ]
}`;

    const userPrompt = `EQUIPAMENTO: ${equipmentInfo.name} (${equipmentInfo.brand} ${equipmentInfo.model})
CATEGORIA DO DEFEITO: ${equipmentInfo.category.toUpperCase()}
DEFEITO RELATADO: "${equipmentInfo.defect}"

Gere um diagnóstico técnico rigoroso com no mínimo 3 causas prováveis e um plano de ação detalhado.`;

    // Montagem do conteúdo da mensagem do usuário (Texto + Imagem Opcional)
    let userContent: any;
    
    if (imageBase64) {
      userContent = [
        { type: "text", text: userPrompt },
        { 
          type: "image_url", 
          image_url: { 
            url: `data:image/jpeg;base64,${imageBase64}`,
            detail: "high"
          } 
        }
      ];
    } else {
      userContent = userPrompt;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userContent }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Mínimo para máxima fidelidade ao manual
        max_tokens: 2048, // Mantém resposta detalhada dentro do limite de 30k TPM
      });

      const text = response.choices[0].message.content;
      if (!text) throw new Error("A IA retornou uma resposta vazia.");
      
      const parsed = JSON.parse(text);

      const sanitized = sanitizeResult(parsed);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/240d5f97-0e7f-435f-997f-7f599a21e610',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          id:`log_${Date.now()}_aiService`,
          timestamp:Date.now(),
          location:'services/aiService.ts:analyzeEquipment',
          message:'Sanitized diagnostic result summary',
          data:{
            possibleCausesCount:sanitized.possible_causes.length,
            solutionsCount:sanitized.solutions.length
          },
          runId:'pre-fix',
          hypothesisId:'H1'
        })
      }).catch(()=>{});
      // #endregion

      return sanitized;
      
    } catch (error: any) {
      console.error("Erro Crítico OpenAI Service:", error);
      throw new Error(`Falha no Diagnóstico GPT-4o: ${error.message}`);
    }
  }
};
