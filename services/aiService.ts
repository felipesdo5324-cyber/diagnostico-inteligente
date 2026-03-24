
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

/**
 * Extrai texto de um PDF usando pdfjs-dist
 */
async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  try {
    // Importar dinamicamente para evitar problemas de build
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configurar worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    // Converter base64 para Uint8Array
    const pdfData = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    
    // Carregar PDF
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    
    let fullText = '';
    
    // Extrair texto de todas as páginas
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    throw new Error('Não foi possível extrair texto do PDF. Verifique se o arquivo está válido.');
  }
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

    // ── RAG: gerar embedding com query enriquecida e buscar trechos no Supabase ──────
    // Query enriquecida = equipamento + marca + modelo + categoria + defeito
    // Equivale ao que NotebookLM faz: pesquisa contextual ampla antes de responder
    let manualContext = "";
    let ragSourcesLog: string[] = [];

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
            match_count: 10  // Aumentado: mais contexto = menos alucinação
          }
        );

        if (ragError) {
          console.error("Erro na busca RAG:", ragError);
        } else if (ragResults && ragResults.length > 0) {
          // Inclui metadados de seção/página para o modelo citar com precisão (estilo NotebookLM)
          manualContext = ragResults
            .map((r: any, i: number) => {
              const header = r.section_title
                ? `[TRECHO ${i + 1} — ${r.section_title}${r.page_number ? `, p.${r.page_number}` : ''}]`
                : `[TRECHO ${i + 1}]`;
              ragSourcesLog.push(header);
              return `${header}\n${r.content}`;
            })
            .join("\n\n---\n\n");
        }
      }
    } catch (ragErr: any) {
      console.error("Falha no pipeline RAG (embedding/RPC):", ragErr.message);
    }

    // Fallback: se RAG não retornou nada, usa o manualContent recebido como parâmetro
    const finalManualContext = manualContext || manualContent || "";
    const usingRAG = manualContext.length > 0;

    const systemInstruction = `Você é um sistema de diagnóstico técnico industrial da Tecnoloc, especializado em geradores, torres de iluminação e compressores. Seu comportamento é idêntico ao NotebookLM: você SOMENTE responde com base nos documentos fornecidos, nunca inventa informações.

${finalManualContext
  ? `╔══════════════════════════════════════════════════════════╗
   DOCUMENTOS DO MANUAL TÉCNICO (BASE EXCLUSIVA DE RESPOSTA)
╚══════════════════════════════════════════════════════════╝

${finalManualContext}

╔══════════════════════════════════════════════════════════╗
   REGRAS DE GROUNDING OBRIGATÓRIAS (como o NotebookLM)
╚══════════════════════════════════════════════════════════╝
1. USE APENAS os trechos do manual acima. PROIBIDO usar conhecimento externo ao documento.
2. Para cada causa e cada passo de solução, você DEVE citar o trecho de onde a informação foi extraída (ex: "[TRECHO 3 — Seção 4.2]").
3. Se o manual mencionar valores exatos (pressão, tensão, torque, temperatura), transcreva-os literalmente — nunca aproxime.
4. Se o manual mencionar um código de erro ou alarme associado ao defeito, inclua o código e seu significado exato.
5. Se os trechos fornecidos NÃO contiverem informação suficiente para diagnosticar o defeito, indique isso explicitamente em vez de inventar.
6. NÃO generalize, NÃO parafraseie além do necessário, NÃO adicione passos que não estejam no manual.`
  : `MANUAL TÉCNICO: Não disponível para este equipamento.
Utilize seu conhecimento de manutenção industrial, mas sinalize claramente que as informações NÃO vêm de um manual específico.`}

${previousSolutions
  ? `=== EXPERIÊNCIAS ANTERIORES DE CAMPO (contexto adicional) ===
${previousSolutions}
===`
  : ''}

REGRAS DE SAÍDA — SIGA OBRIGATORIAMENTE:
1. Forneça pelo menos 3 causas prováveis, cada uma com referência ao trecho do manual (quando disponível).
2. Cada solução deve ter NO MÍNIMO 3 passos claros extraídos do manual.
3. Use a terminologia exata do manual (nomes de peças, procedimentos, valores).
4. O campo 'difficulty' deve ser obrigatoriamente: 'Fácil', 'Média' ou 'Difícil'.

FORMATO OBRIGATÓRIO (JSON válido, sem texto fora do JSON):
{
  "possible_causes": ["Causa 1 [TRECHO X]", "Causa 2 [TRECHO Y]", "Causa 3 [TRECHO Z]"],
  "solutions": [
    {
      "title": "Título exato do procedimento do manual",
      "steps": ["Passo 1 conforme manual", "Passo 2 conforme manual", "Passo 3 conforme manual"],
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
            solutionsCount:sanitized.solutions.length,
            ragUsed: usingRAG,
            ragSources: ragSourcesLog
          },
          runId:'rag-grounding',
          hypothesisId:'H2'
        })
      }).catch(()=>{});
      // #endregion

      return sanitized;
      
    } catch (error: any) {
      console.error("Erro Crítico OpenAI Service:", error);
      throw new Error(`Falha no Diagnóstico GPT-4o: ${error.message}`);
    }
  },

  /**
   * Extrai falhas e resoluções de um documento PDF usando IA visão
   */
  extractFailuresFromPDF: async (
    pdfBase64: string,
    equipamento: string,
    modelo: string,
    categoria: 'eletrica' | 'mecanica'
  ): Promise<Array<{ titulo: string; falha: string; resolucao: string }>> => {
    if (!apiKey) {
      throw new Error("Chave de API da OpenAI não configurada (OPENAI_API_KEY).");
    }

    try {
      // Primeiro, extrair texto do PDF
      const pdfText = await extractTextFromPDF(pdfBase64);
      
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error("O PDF não contém texto legível ou está vazio.");
      }

      const systemPrompt = `Você é um especialista em análise de documentos técnicos de manutenção. 
Sua tarefa é extrair de um documento de texto uma lista estruturada de falhas e suas resoluções.

EQUIPAMENTO: ${equipamento}
MODELO: ${modelo}
CATEGORIA: ${categoria === 'eletrica' ? 'Elétrica' : 'Mecânica'}

CONTEÚDO DO DOCUMENTO:
${pdfText}

Para cada falha encontrada no documento, extraia:
1. Um título curto e descritivo da falha
2. A descrição completa do sintoma/falha
3. Os passos detalhados de resolução

FORMATO DE SAÍDA (JSON válido):
{
  "failures": [
    {
      "titulo": "Título descritivo (5-10 palavras)",
      "falha": "Descrição completa do sintoma/falha conforme documento",
      "resolucao": "Passos numerados ou detalhados de resolução conforme documento"
    }
  ]
}

IMPORTANTE:
- Mantenha a linguagem e terminologia do documento original
- Se houver múltiplas falhas, crie uma entrada para cada uma
- Se não encontrar falhas estruturadas, tente extrair informações de problemas/soluções mencionados
- Sempre retorne um JSON válido`;

      const userPrompt = `Analise o conteúdo do documento acima e extraia todas as falhas/problemas e suas resoluções. 
O documento é um manual de manutenção para um ${equipamento} modelo ${modelo} da categoria ${categoria}.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: systemPrompt 
          },
          { 
            role: "user", 
            content: userPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 4096
      });

      const text = response.choices[0].message.content;
      if (!text) throw new Error("A IA retornou uma resposta vazia ao processar o PDF.");

      const parsed = JSON.parse(text);
      const failures = Array.isArray(parsed.failures) ? parsed.failures : [];

      if (failures.length === 0) {
        throw new Error("Nenhuma falha foi encontrada no PDF. Verifique se o documento contém informações de falhas e resoluções.");
      }

      // Validar estrutura de cada falha
      const validFailures = failures.filter((f: any) => 
        f.titulo && typeof f.titulo === 'string' &&
        f.falha && typeof f.falha === 'string' &&
        f.resolucao && typeof f.resolucao === 'string'
      );

      if (validFailures.length === 0) {
        throw new Error("O formato das falhas extraídas é inválido. Tente com outro documento.");
      }

      return validFailures;

    } catch (error: any) {
      console.error("Erro ao extrair falhas do PDF:", error);
      throw new Error(`Erro ao processar PDF: ${error.message}`);
    }
  }
};
